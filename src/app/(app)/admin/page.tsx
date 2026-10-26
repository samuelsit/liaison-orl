import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCards } from "@/components/admin/service-cards";
import { getAdminContext } from "@/lib/auth/session";
import { serviceStatus } from "@/server/services/service-status";
import { computeStats } from "@/server/services/stats";

export const metadata: Metadata = { title: "Administration" };

const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export default async function AdminHome() {
  const ctx = await getAdminContext();
  const [services, stats] = await Promise.all([serviceStatus({ test: false }), computeStats(ctx.user, 30)]);
  const tiles = [
    { label: "Documents (30 jours)", value: String(stats.totals.documents) },
    { label: "Envois e-mail / courrier", value: `${stats.totals.emails} / ${stats.totals.letters}` },
    { label: "Taux d'erreur d'envoi", value: `${(stats.totals.errorRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` },
    { label: "Coût courrier", value: euros(stats.totals.postalCostCents) },
  ];
  return (
    <div className="space-y-8">
      <section aria-labelledby="t-services" className="space-y-3">
        <h2 id="t-services" className="text-lg font-semibold">
          État des services
        </h2>
        <ServiceCards initial={services} />
      </section>
      <section aria-labelledby="t-activite" className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 id="t-activite" className="text-lg font-semibold">
            Activité des 30 derniers jours
          </h2>
          <Link href="/admin/statistiques" className="text-sm text-brand-fg underline-offset-4 hover:underline">
            Statistiques détaillées
          </Link>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{t.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
