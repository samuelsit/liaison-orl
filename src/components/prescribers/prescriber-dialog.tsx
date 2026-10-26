"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListRowAvatar } from "@/components/layout/list-row";
import { personInitials } from "@/components/directory/utils";
import { createPrescriberAction, updatePrescriberAction } from "@/server/actions/prescribers";
import type { PrescriberInput } from "@/lib/schemas/prescriber";
import type { PrescriberView } from "@/server/services/prescribers";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { PrescriberForm } from "./prescriber-form";
import { formatPrescriberName } from "./format";

const T = dirFr.prescribers;

/**
 * Création / modification d'une fiche prescripteur. Pied collant (toujours visible),
 * feuille basse sur téléphone, détection des doublons avant création.
 * Utilisé par l'annuaire, la fiche et la sélection du prescripteur dans les documents (`compact`).
 */
export function PrescriberDialog({
  open,
  onOpenChange,
  centres,
  salutations,
  initial,
  onSaved,
  compact,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centres: { id: string; name: string }[];
  salutations: string[];
  /** Fiche à modifier ; absente = création. */
  initial?: PrescriberView | null;
  onSaved?: (p: PrescriberView) => void;
  compact?: boolean;
  /** Valeurs pré-remplies à la création (ex. texte recherché). */
  prefill?: { lastName?: string; firstName?: string };
}) {
  const [similar, setSimilar] = useState<{ list: PrescriberView[]; pending: PrescriberInput } | null>(null);
  const [forcing, setForcing] = useState(false);
  const isEdit = Boolean(initial);

  async function submit(values: PrescriberInput, force = false) {
    if (initial) {
      const res = await updatePrescriberAction(initial.id, values);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? T.saved);
      onSaved?.(res.data);
      onOpenChange(false);
      return;
    }
    const res = await createPrescriberAction(values, force);
    if (!res.ok) return void toast.error(res.error);
    if (res.data.similar.length && !res.data.created) {
      setSimilar({ list: res.data.similar, pending: values });
      return;
    }
    if (res.data.created) {
      toast.success(T.created);
      onSaved?.(res.data.created);
      setSimilar(null);
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSimilar(null);
        onOpenChange(o);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{similar ? T.similarTitle : isEdit ? T.edit : T.new}</DialogTitle>
          <DialogDescription>{similar ? T.similarDescription : isEdit ? formatPrescriberName(initial!) : T.dialogDescription}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {similar ? (
            <div role="alert" className="space-y-4">
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {similar.list.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <ListRowAvatar initials={personInitials(p.firstName, p.lastName)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{formatPrescriberName(p)}</span>
                      <span className="block truncate text-meta text-muted-foreground">
                        {[p.practiceName, p.address.city, p.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onSaved?.(p);
                        setSimilar(null);
                        onOpenChange(false);
                      }}
                    >
                      {T.useExisting}
                    </Button>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSimilar(null)}>
                  {T.backToForm}
                </Button>
                <Button
                  variant="outline"
                  disabled={forcing}
                  onClick={async () => {
                    setForcing(true);
                    await submit(similar.pending, true);
                    setForcing(false);
                  }}
                >
                  {T.createAnyway}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
          {/* Le formulaire reste monté pendant la vérification des doublons : « Revenir au formulaire » conserve la saisie. */}
          <div hidden={Boolean(similar)}>
            <PrescriberForm
              defaultValues={initial ?? prefill}
              centres={centres}
              salutations={salutations}
              submitLabel={isEdit ? fr.common.save : T.submitCreate}
              onSubmit={(v) => submit(v)}
              onCancel={() => onOpenChange(false)}
              compact={compact}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
