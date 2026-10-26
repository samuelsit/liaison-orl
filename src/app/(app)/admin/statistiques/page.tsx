import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { StackedColumns } from "@/components/charts/stacked-columns";
import { BarList } from "@/components/charts/bar-list";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/auth/session";
import { computeStats } from "@/server/services/stats";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistiques" };

const PERIODS = [30, 90, 180, 365] as const;
const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const usd = (micro: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(micro / 1e6);
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const KIND_LABEL: Record<string, string> = { extraction: "Lecture de bilans", comment: "Commentaires", motif: "Motifs d'adressage", dictation: "Dictées", email: "E-mails" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const ctx = await getAdminContext();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.jours) as (typeof PERIODS)[number]) ? Number(sp.jours) : 180;
  const s = await computeStats(ctx.user, days);
  const tiles = [
    { label: "Documents créés", value: s.totals.documents.toLocaleString("fr-FR") },
    { label: "Documents envoyés", value: s.totals.sent.toLocaleString("fr-FR") },
    { label: "Envois (e-mail / courrier)", value: `${s.totals.emails} / ${s.totals.letters}` },
    { label: "Taux d'erreur d'envoi", value: `${(s.totals.errorRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` },
    { label: "Coût courrier", value: euros(s.totals.postalCostCents) },
    { label: "Délai médian création → envoi", value: s.totals.medianHoursToSend === null ? "—" : s.totals.medianHoursToSend < 48 ? `${Math.round(s.totals.medianHoursToSend)} h` : `${Math.round(s.totals.medianHoursToSend / 24)} j` },
  ];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Période :</span>
        {PERIODS.map((p) => (
          <Link key={p} href={`/admin/statistiques?jours=${p}`} aria-current={days === p ? "page" : undefined} className={cn("inline-flex h-9 items-center rounded-full border px-4 text-sm", days === p ? "border-transparent bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
            {p === 365 ? "12 mois" : `${p} jours`}
          </Link>
        ))}
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <a href={`/api/admin/statistiques?jours=${days}`}>
            <Download aria-hidden /> Exporter (CSV)
          </a>
        </Button>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className="mt-1 text-xl font-semibold">{t.value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Documents créés par mois</h2>
        <StackedColumns
          title="Documents créés par mois"
          series={[
            { name: "Comptes rendus", color: "var(--dv-1)" },
            { name: "Adressages", color: "var(--dv-2)" },
          ]}
          data={s.monthly.map((m) => ({ label: `${MONTHS[Number(m.month.slice(5)) - 1]} ${m.month.slice(2, 4)}`, values: [m.compteRendu, m.adressage] }))}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Documents par centre</h2>
          <BarList rows={s.byCentre.map((r) => ({ label: r.label, value: r.total, hint: `${r.compteRendu} comptes rendus, ${r.adressage} adressages` }))} />
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Documents par audioprothésiste</h2>
          <BarList rows={s.byAuthor.map((r) => ({ label: r.label, value: r.total }))} />
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Prescripteurs les plus sollicités</h2>
          <BarList rows={s.byPrescriber.map((r) => ({ label: r.label, value: r.total }))} />
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Coût du courrier par centre</h2>
          <BarList rows={s.byCentre.filter((r) => r.postalCostCents > 0).map((r) => ({ label: r.label, value: r.postalCostCents }))} format={euros} empty="Aucun courrier sur la période." />
        </section>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-1 font-semibold">Consommation de l&apos;IA</h2>
        <p className="mb-3 text-sm text-muted-foreground">Coût estimé à partir des tarifs publics (jetons consommés). Les appels du mode démo ne coûtent rien.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 font-medium">Centre</th>
                <th scope="col" className="py-2 text-right font-medium">Appels</th>
                <th scope="col" className="py-2 text-right font-medium">Erreurs d&apos;envoi</th>
                <th scope="col" className="py-2 text-right font-medium">Coût IA estimé</th>
              </tr>
            </thead>
            <tbody>
              {s.byCentre.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <th scope="row" className="py-2 text-left font-normal">{r.label}</th>
                  <td className="py-2 text-right tabular-nums">{r.aiCalls}</td>
                  <td className="py-2 text-right tabular-nums">{r.errors}</td>
                  <td className="py-2 text-right tabular-nums">{usd(r.aiCostMicroUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {s.aiByKind.map((k) => (
            <li key={k.kind} className="rounded-lg bg-muted/50 p-3">
              <span className="block text-muted-foreground">{KIND_LABEL[k.kind] ?? k.kind}</span>
              <span className="block font-semibold">
                {k.calls} appel(s) · {usd(k.costMicroUsd)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {(k.inputTokens + k.outputTokens).toLocaleString("fr-FR")} jetons{k.failures ? ` · ${k.failures} échec(s)` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
