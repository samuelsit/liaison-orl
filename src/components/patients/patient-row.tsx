"use client";

import Link from "next/link";
import { ClipboardPlus, FilePen, FilePlus2, Pencil, Stethoscope } from "lucide-react";
import { ListRow, ListRowAvatar } from "@/components/layout/list-row";
import type { RowAction } from "@/components/layout/list-row-actions";
import { badgeVariants } from "@/components/ui/badge";
import { Highlight } from "@/components/directory/highlight";
import { DirectoryRowActions } from "@/components/directory/row-actions";
import { personInitials } from "@/components/directory/utils";
import { ageAt, formatIsoDate } from "@/lib/dates";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import type { DocumentType } from "@/lib/schemas/document";
import { formatPersonName } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { PatientView } from "@/server/services/patients";

const T = dirFr.patients;

/**
 * Ligne patient : initiales, nom (termes recherchés surlignés), âge et date de naissance,
 * prescripteur habituel (≥ md), puce « Brouillon en cours » vers le brouillon existant,
 * actions rapides au survol (Nouvel adressage, Nouveau compte rendu) et menu ⋯.
 */
export function PatientRow({
  p,
  today,
  query,
  centreName,
  prescriberName,
  draftId,
  onCreate,
  onEdit,
}: {
  p: PatientView;
  today: string;
  query?: string;
  /** Nom du centre (portée « Tous mes centres »). */
  centreName?: string;
  prescriberName?: string;
  draftId?: string;
  onCreate: (type: DocumentType, p: PatientView) => void;
  onEdit: (p: PatientView) => void;
}) {
  const name = `${p.civility} ${formatPersonName(p.firstName, p.lastName)}`;
  const age = p.birthDate ? ageAt(p.birthDate, today) : null;
  const birth = p.birthDate
    ? [age !== null ? T.age(age) : null, formatIsoDate(p.birthDate)].filter(Boolean).join(" · ")
    : T.noBirthDate;

  const quick: RowAction[] = [
    { label: fr.home.newAdressage, icon: <FilePlus2 />, onSelect: () => onCreate("ADRESSAGE", p), shortcut: ["a"] },
    {
      label: fr.home.newCompteRendu,
      icon: <ClipboardPlus />,
      onSelect: () => onCreate("COMPTE_RENDU", p),
      shortcut: ["c"],
    },
  ];
  const menu: RowAction[] = [{ label: fr.common.edit, icon: <Pencil />, onSelect: () => onEdit(p) }];

  return (
    <ListRow
      href={`/patients/${p.id}`}
      leading={<ListRowAvatar initials={personInitials(p.firstName, p.lastName)} />}
      title={<Highlight text={name} query={query} />}
      subtitle={[birth, centreName].filter(Boolean).join(" · ")}
      subtitleMobile={birth}
      trailing={
        <span className="hidden w-52 min-w-0 items-center gap-1.5 text-meta text-muted-foreground md:flex">
          {prescriberName ? (
            <>
              <Stethoscope className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                <span className="sr-only">{T.fields.usualPrescriber} : </span>
                {prescriberName}
              </span>
            </>
          ) : null}
        </span>
      }
      // Largeur fixe ≥ sm : les colonnes restent alignées d'une ligne à l'autre, avec ou sans brouillon.
      badge={
        <span className="flex justify-end sm:w-36">
          {draftId ? (
            <Link
              href={`/documents/${draftId}`}
              aria-label={T.resumeDraft(name)}
              className={cn(
                badgeVariants({ tone: "neutral" }),
                "relative z-10 overflow-visible hover:bg-muted/70 hover:text-foreground after:absolute after:-inset-x-1 after:-inset-y-2.5 pointer-coarse:after:-inset-y-3",
              )}
            >
              <FilePen aria-hidden />
              <span className="sm:hidden">{T.draftShort}</span>
              <span className="max-sm:hidden">{T.draftInProgress}</span>
            </Link>
          ) : null}
        </span>
      }
      pinnedActions={<DirectoryRowActions quick={quick} menu={menu} label={T.rowActions(name)} />}
    />
  );
}
