import type { Metadata } from "next";
import { ServiceCards } from "@/components/admin/service-cards";
import { getAdminContext } from "@/lib/auth/session";
import { appUrl, env, pingenEnvironment } from "@/lib/env";
import { serviceStatus } from "@/server/services/service-status";

export const metadata: Metadata = { title: "État des services" };

export default async function ServicesPage() {
  await getAdminContext();
  const states = await serviceStatus({ test: false });
  const e = env();
  const base = appUrl();
  const rows: [string, string, string][] = [
    ["Webhook Resend (événements e-mail)", `${base}/api/webhooks/resend`, e.RESEND_WEBHOOK_SECRET ? "Secret configuré" : "RESEND_WEBHOOK_SECRET manquant"],
    ["Webhooks Pingen (issues, sent, undeliverable, delivered)", `${base}/api/webhooks/pingen`, e.PINGEN_WEBHOOK_SECRET ? "Clé de signature configurée" : "PINGEN_WEBHOOK_SECRET manquant"],
    ["Tâche planifiée : suivi des statuts", `${base}/api/cron/statuts`, e.CRON_SECRET ? "Protégée par CRON_SECRET" : "CRON_SECRET manquant (obligatoire en production)"],
    ["Tâche planifiée : purge", `${base}/api/cron/purge`, e.CRON_SECRET ? "Protégée par CRON_SECRET" : "CRON_SECRET manquant (obligatoire en production)"],
  ];
  return (
    <div className="space-y-8">
      <ServiceCards initial={states} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Adresses à déclarer chez les prestataires</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <tbody>
              {rows.map(([label, url, status]) => (
                <tr key={url} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{label}</th>
                  <td className="px-4 py-3 font-mono text-xs break-all">{url}</td>
                  <td className="px-4 py-3 text-muted-foreground">{status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Courrier : environnement Pingen <strong>{pingenEnvironment() === "production" ? "production" : "staging (aucun envoi réel)"}</strong>. La production n&apos;est utilisée que si PINGEN_ENV=production sur le déploiement de production.
        </p>
      </section>
    </div>
  );
}
