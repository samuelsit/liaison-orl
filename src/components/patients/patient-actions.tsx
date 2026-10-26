"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCreateDocument } from "@/hooks/use-create-document";
import { deletePatientAction } from "@/server/actions/patients";
import type { PatientView } from "@/server/services/patients";
import type { PrescriberView } from "@/server/services/prescribers";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { PatientDialog } from "./patient-dialog";

export function PatientActions({
  patient,
  prescriber,
  centres,
  salutations,
  canDelete,
}: {
  patient: PatientView;
  prescriber: PrescriberView | null;
  centres: { id: string; name: string }[];
  salutations: string[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { create, pending } = useCreateDocument();
  const [deleting, startDelete] = useTransition();
  return (
    <>
      <Button disabled={pending} onClick={() => create("ADRESSAGE", { patientId: patient.id })}>
        <FileText aria-hidden /> {fr.home.newAdressage}
      </Button>
      <Button disabled={pending} onClick={() => create("COMPTE_RENDU", { patientId: patient.id })}>
        <ClipboardList aria-hidden /> {fr.home.newCompteRendu}
      </Button>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> {fr.common.edit}
      </Button>
      {canDelete ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive">
              <Trash2 aria-hidden /> {dirFr.patients.delete}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dirFr.patients.delete}</AlertDialogTitle>
              <AlertDialogDescription>{dirFr.patients.deleteConfirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                variant="destructive-solid"
                onClick={() =>
                  startDelete(async () => {
                    const res = await deletePatientAction(patient.id);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(dirFr.patients.deleted);
                    router.replace("/patients");
                  })
                }
              >
                {fr.common.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      <PatientDialog
        open={open}
        onOpenChange={setOpen}
        centres={centres}
        activeCentreId={patient.centreId}
        salutations={salutations}
        initial={patient}
        initialPrescriber={prescriber}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
