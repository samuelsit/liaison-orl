"use client";

import { useState, type ComponentProps } from "react";
import { ClipboardPlus, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCreateDocument } from "@/hooks/use-create-document";
import { fr } from "@/lib/i18n/fr";
import type { DocumentType } from "@/lib/schemas/document";
import { cn } from "@/lib/utils";

type Context = { patientId?: string | null; prescriberId?: string | null };

export const DOCUMENT_ICON = { ADRESSAGE: FilePlus2, COMPTE_RENDU: ClipboardPlus } as const;
const LABEL = { ADRESSAGE: fr.home.newAdressage, COMPTE_RENDU: fr.home.newCompteRendu } as const;
/** Libellés courts de la barre basse mobile (le nom accessible garde le libellé complet). */
const SHORT = { ADRESSAGE: fr.documentTypesShort.ADRESSAGE, COMPTE_RENDU: fr.documentTypesShort.COMPTE_RENDU } as const;

/** Bouton « Nouvel adressage / compte rendu » pour un patient ou un prescripteur, avec indicateur. */
export function CreateDocumentButton({
  type,
  context,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type"> & { type: DocumentType; context: Context }) {
  const { create, pending } = useCreateDocument();
  const Icon = DOCUMENT_ICON[type];
  return (
    <Button {...props} disabled={pending || props.disabled} onClick={() => create(type, context)}>
      {pending ? <Spinner /> : <Icon aria-hidden />}
      {children ?? LABEL[type]}
    </Button>
  );
}

/**
 * Les deux créations d'une fiche (compte rendu en secondaire, adressage en principal).
 * Un seul jeu de boutons : dans l'en-tête à partir de sm, fixé en bas de l'écran (au-dessus
 * de la barre d'onglets) sur téléphone. Prévoir une marge basse sur la page (`max-sm:pb-24`).
 */
export function CreateDocumentActions({ context, className }: { context: Context; className?: string }) {
  const { create, pending } = useCreateDocument();
  const [clicked, setClicked] = useState<DocumentType | null>(null);

  const button = (type: DocumentType, variant: "default" | "outline") => {
    const Icon = DOCUMENT_ICON[type];
    return (
      <Button
        variant={variant}
        disabled={pending}
        aria-label={LABEL[type]}
        className="max-sm:h-11 max-sm:w-full"
        onClick={() => {
          setClicked(type);
          create(type, context);
        }}
      >
        {pending && clicked === type ? <Spinner /> : <Icon aria-hidden />}
        <span className="sm:hidden">{SHORT[type]}</span>
        <span className="max-sm:hidden">{LABEL[type]}</span>
      </Button>
    );
  };

  return (
    <div
      data-slot="create-document-actions"
      className={cn(
        "flex items-center gap-2",
        "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-(--bottom-nav-height) max-sm:z-30 max-sm:grid max-sm:grid-cols-2 max-sm:border-t max-sm:bg-background/95 max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:shadow-[0_-4px_12px_-6px_var(--shadow-2)] max-sm:backdrop-blur",
        className,
      )}
    >
      {button("COMPTE_RENDU", "outline")}
      {button("ADRESSAGE", "default")}
    </div>
  );
}
