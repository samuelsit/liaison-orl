"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, GitMerge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { CsvImportDialog } from "@/components/prescribers/csv-import-dialog";
import { formatPrescriberName } from "@/components/prescribers/format";
import { mergePrescribersAction } from "@/server/actions/prescribers";
import type { PrescriberView } from "@/server/services/prescribers";

export function DuplicatesAdmin({ groups }: { groups: PrescriberView[][] }) {
  const router = useRouter();
  const [masters, setMasters] = useState<Record<number, string>>(() => Object.fromEntries(groups.map((g, i) => [i, g[0]!.id])));
  const [csv, setCsv] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Importez l&apos;annuaire existant (export Cosium, tableur…) ; les doublons sont détectés automatiquement.</p>
        <Button onClick={() => setCsv(true)}>
          <FileUp aria-hidden /> Importer un CSV
        </Button>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Doublons probables ({groups.length})</h2>
        {groups.length === 0 ? (
          <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyTitle>Aucun doublon détecté</EmptyTitle>
              <EmptyDescription>Les fiches sont rapprochées par RPPS, e-mail ou nom + code postal.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          groups.map((g, i) => (
            <div key={g.map((p) => p.id).join("-")} className="space-y-3 rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Choisissez la fiche à conserver ; les autres y seront fusionnées (documents, patients et envois rattachés).</p>
              <RadioGroup value={masters[i]} onValueChange={(v) => setMasters((m) => ({ ...m, [i]: v }))}>
                {g.map((p) => (
                  <label key={p.id} className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
                    <RadioGroupItem value={p.id} className="mt-0.5" />
                    <span>
                      <span className="block font-medium">{formatPrescriberName(p)}</span>
                      <span className="block text-muted-foreground">{[p.practiceName, p.address.line1, `${p.address.postalCode} ${p.address.city}`, p.email, p.phone, p.rpps && `RPPS ${p.rpps}`].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await mergePrescribersAction(masters[i]!, g.map((p) => p.id));
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(res.message ?? "Fusionné.");
                    router.refresh();
                  })
                }
              >
                <GitMerge aria-hidden /> Fusionner ces {g.length} fiches
              </Button>
            </div>
          ))
        )}
      </section>
      <CsvImportDialog open={csv} onOpenChange={setCsv} onDone={() => router.refresh()} />
    </div>
  );
}
