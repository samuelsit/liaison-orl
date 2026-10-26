"use client";

import { createContext, useContext, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Ellipsis, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { copyToClipboard } from "@/components/directory/copy-button";
import { CreateDocumentActions } from "@/components/directory/create-document-actions";
import { setPrescriberArchivedAction } from "@/server/actions/prescribers";
import type { PrescriberView } from "@/server/services/prescribers";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { PrescriberDialog } from "./prescriber-dialog";
import { contactText } from "./format";

const T = dirFr.prescribers;

const EditContext = createContext<{ openEdit: () => void; canEdit: boolean } | null>(null);

/**
 * Fiche prescripteur : fournit la fenêtre de modification à toute la page (bouton
 * « Modifier » de l'en-tête, liens « Ajouter un e-mail » / « Compléter l'adresse »).
 */
export function PrescriberEditProvider({
  prescriber,
  centres,
  salutations,
  canEdit,
  children,
}: {
  prescriber: PrescriberView;
  centres: { id: string; name: string }[];
  salutations: string[];
  canEdit: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <EditContext.Provider value={{ openEdit: () => setOpen(true), canEdit }}>
      {children}
      {canEdit ? (
        <PrescriberDialog
          open={open}
          onOpenChange={setOpen}
          centres={centres}
          salutations={salutations}
          initial={prescriber}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </EditContext.Provider>
  );
}

/** Bouton ouvrant la modification de la fiche (rien si l'utilisateur ne peut pas modifier). */
export function EditPrescriberButton({ children, ...props }: Omit<ComponentProps<typeof Button>, "onClick">) {
  const ctx = useContext(EditContext);
  if (!ctx?.canEdit) return null;
  return (
    <Button type="button" {...props} onClick={ctx.openEdit}>
      {children}
    </Button>
  );
}

/**
 * Actions de l'en-tête de la fiche : Modifier, menu ⋯ (copier les coordonnées, archiver),
 * puis Nouveau compte rendu / Nouvel adressage (barre basse sur téléphone).
 * Fiche archivée : « Restaurer » devient l'action principale.
 */
export function PrescriberActions({ prescriber, canArchive }: { prescriber: PrescriberView; canArchive: boolean }) {
  const router = useRouter();
  const [archiving, startArchive] = useTransition();

  function setArchived(archived: boolean) {
    startArchive(async () => {
      const res = await setPrescriberArchivedAction(prescriber.id, archived);
      if (!res.ok) return void toast.error(res.error);
      toast.success(archived ? T.archived : T.restored, {
        action: {
          label: fr.common.undo,
          onClick: () => void setPrescriberArchivedAction(prescriber.id, !archived).then(() => router.refresh()),
        },
      });
      router.refresh();
    });
  }

  return (
    <>
      <EditPrescriberButton variant="outline">
        <Pencil aria-hidden /> {fr.common.edit}
      </EditPrescriberButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={fr.common.moreActions}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-56">
          <DropdownMenuItem onSelect={() => void copyToClipboard(contactText(prescriber), T.copied.contact)}>
            <Copy aria-hidden /> {T.copyContact}
          </DropdownMenuItem>
          {canArchive && !prescriber.archived ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={archiving} onSelect={() => setArchived(true)}>
                <Archive aria-hidden /> {T.archive}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {prescriber.archived ? (
        canArchive ? (
          <Button disabled={archiving} onClick={() => setArchived(false)}>
            {archiving ? <Spinner /> : <ArchiveRestore aria-hidden />} {T.restore}
          </Button>
        ) : null
      ) : (
        <CreateDocumentActions context={{ prescriberId: prescriber.id }} />
      )}
    </>
  );
}
