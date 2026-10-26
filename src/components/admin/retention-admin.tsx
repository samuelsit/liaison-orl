"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Loader2, Save, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { purgeAction, updateSettingsAction } from "@/server/actions/admin";
import type { PurgeReport } from "@/server/services/purge";
import type { OrganizationSettings } from "@/lib/schemas/organization";

export function RetentionAdmin({ settings }: { settings: OrganizationSettings }) {
  const router = useRouter();
  const [r, setR] = useState(settings.retention);
  const [preview, setPreview] = useState<PurgeReport | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const row = (label: string, n: number) => (
    <li className="flex justify-between border-b py-1 last:border-0">
      <span>{label}</span>
      <strong className="tabular-nums">{n}</strong>
    </li>
  );
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Durées de conservation</h2>
        <p className="text-sm text-muted-foreground">La purge s&apos;exécute automatiquement chaque nuit. Un document est supprimé (avec son bilan, ses envois et ses PDF) lorsqu&apos;il n&apos;a pas été modifié depuis la durée choisie ; un patient l&apos;est quand il n&apos;a plus aucun document.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField id="docs" label="Documents et patients (mois)">
            <Input id="docs" type="number" min={1} max={600} value={r.documentsMonths} onChange={(e) => setR({ ...r, documentsMonths: Number(e.target.value) })} />
          </FormField>
          <FormField id="audit" label="Journal d'audit et consommation IA (mois)">
            <Input id="audit" type="number" min={6} max={600} value={r.auditMonths} onChange={(e) => setR({ ...r, auditMonths: Number(e.target.value) })} />
          </FormField>
          <FormField id="outbox" label="E-mails simulés de démonstration (jours)">
            <Input id="outbox" type="number" min={1} max={365} value={r.outboxDays} onChange={(e) => setR({ ...r, outboxDays: Number(e.target.value) })} />
          </FormField>
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await updateSettingsAction({ ...settings, retention: r });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Durées enregistrées.");
              setPreview(null);
              router.refresh();
            })
          }
        >
          <Save aria-hidden /> Enregistrer
        </Button>
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Purge manuelle</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await purgeAction(true);
                if (!res.ok) return void toast.error(res.error);
                setPreview(res.data);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ScanSearch aria-hidden />} Simuler la purge
          </Button>
          <Button variant="outline" className="text-destructive" disabled={pending || !preview} onClick={() => setConfirm(true)}>
            <Eraser aria-hidden /> Purger maintenant
          </Button>
        </div>
        {preview ? (
          <ul className="max-w-md text-sm">
            {row("Documents", preview.documents)}
            {row("Fichiers (PDF, bilans)", preview.files)}
            {row("Entrées du journal d'audit", preview.auditLogs)}
            {row("E-mails simulés", preview.outbox)}
            {row("Consommation IA", preview.aiUsage)}
          </ul>
        ) : null}
      </section>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purger maintenant ?</AlertDialogTitle>
            <AlertDialogDescription>Les éléments listés seront définitivement supprimés. Cette action est irréversible et journalisée.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={() =>
                start(async () => {
                  const res = await purgeAction(false);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(`Purge effectuée : ${res.data.documents} document(s), ${res.data.patients} patient(s).`);
                  setPreview(null);
                  router.refresh();
                })
              }
            >
              Purger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
