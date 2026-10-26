"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListRowAvatar } from "@/components/layout/list-row";
import { personInitials } from "@/components/directory/utils";
import { createPatientAction, updatePatientAction } from "@/server/actions/patients";
import type { DocumentType } from "@/lib/schemas/document";
import type { PatientView } from "@/server/services/patients";
import type { PrescriberView } from "@/server/services/prescribers";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { formatIsoDate } from "@/lib/dates";
import { formatPersonName } from "@/lib/text";
import { PatientForm, type PatientFormValues } from "./patient-form";

const T = dirFr.patients;

/**
 * Création / modification d'un patient. Pied collant, feuille basse sur téléphone,
 * détection des doublons avant création. Utilisé par la liste, la fiche et la sélection
 * du patient dans les documents (`showPrescriber={false}`).
 * `documentIntents` : le bouton de création propose aussi de rédiger directement un document ;
 * le type choisi est passé en second argument de `onSaved`.
 */
export function PatientDialog({
  open,
  onOpenChange,
  centres,
  activeCentreId,
  salutations,
  initial,
  initialPrescriber,
  prefill,
  onSaved,
  showPrescriber,
  documentIntents,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  centres: { id: string; name: string }[];
  activeCentreId: string;
  salutations: string[];
  initial?: PatientView | null;
  initialPrescriber?: PrescriberView | null;
  prefill?: { lastName?: string; firstName?: string; birthDate?: string };
  onSaved?: (p: PatientView, next?: DocumentType) => void;
  showPrescriber?: boolean;
  documentIntents?: boolean;
}) {
  const [similar, setSimilar] = useState<{ list: PatientView[]; pending: PatientFormValues; next?: DocumentType } | null>(null);
  const [forcing, setForcing] = useState(false);

  async function submit(values: PatientFormValues, next?: DocumentType, force = false) {
    if (initial) {
      const res = await updatePatientAction(initial.id, values);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? T.saved);
      onSaved?.(res.data);
      onOpenChange(false);
      return;
    }
    const res = await createPatientAction(values, force);
    if (!res.ok) return void toast.error(res.error);
    if (!res.data.created && res.data.similar.length) return void setSimilar({ list: res.data.similar, pending: values, next });
    if (res.data.created) {
      toast.success(T.created);
      onSaved?.(res.data.created, next);
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
          <DialogTitle>{similar ? T.similarTitle : initial ? T.edit : T.new}</DialogTitle>
          <DialogDescription>
            {similar ? T.similarDescription : initial ? `${initial.civility} ${formatPersonName(initial.firstName, initial.lastName)}` : T.subtitle}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {similar ? (
            <div role="alert" className="space-y-4">
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {similar.list.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <ListRowAvatar initials={personInitials(p.firstName, p.lastName)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.civility} {formatPersonName(p.firstName, p.lastName)}
                      </span>
                      <span className="block truncate text-meta text-muted-foreground">
                        {p.birthDate ? T.bornOn(formatIsoDate(p.birthDate)) : T.noBirthDate}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onSaved?.(p, similar.next);
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
                    await submit(similar.pending, similar.next, true);
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
            <PatientForm
              defaultValues={initial ? { ...initial } : { centreId: activeCentreId, ...prefill }}
              defaultPrescriber={initialPrescriber}
              centres={centres}
              salutations={salutations}
              submitLabel={initial ? fr.common.save : T.submitCreate}
              onSubmit={(v, next) => submit(v, next)}
              onCancel={() => onOpenChange(false)}
              showPrescriber={showPrescriber}
              documentIntents={documentIntents && !initial}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
