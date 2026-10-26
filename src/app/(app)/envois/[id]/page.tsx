import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Info, Lock, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DispatchStatusBadge } from "@/components/documents/status-badge";
import { DispatchActions } from "@/components/dispatches/dispatch-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can, canAccessCentre } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { formatDateTime } from "@/lib/dates";
import { fr } from "@/lib/i18n/fr";
import { ERROR_STATUSES } from "@/lib/schemas/dispatch";
import { refreshMockDispatches } from "@/server/services/dispatch-status";

export const metadata: Metadata = { title: "Suivi d'envoi" };

const EVENT_LABEL: Record<string, string> = {
  created: "Envoi créé",
  "email.sent": "E-mail accepté par le service d'envoi",
  "email.delivered": "E-mail délivré au serveur du destinataire",
  "email.opened": "E-mail ouvert",
  "email.bounced": "E-mail rejeté",
  "email.failed": "Échec de l'envoi",
  "email.delivery_delayed": "Remise retardée",
  "link.opened": "Document consulté via le lien sécurisé",
  "letter.valid": "Courrier validé par le prestataire",
  "letter.submitted": "Courrier transmis pour impression",
  "letter.printing": "Courrier en impression",
  "letter.sent": "Courrier remis à La Poste",
  webhook_sent: "Courrier remis à La Poste",
  webhook_delivered: "Courrier distribué",
  webhook_undeliverable: "Courrier non distribuable",
  webhook_issues: "Problème signalé par le prestataire",
  cancelled: "Envoi annulé",
  error: "Erreur",
};

const euros = (cents: number, currency = "EUR") => new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);

export default async function DispatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  await refreshMockDispatches(ctx.user.organizationId).catch(() => undefined);
  const d = await collections().dispatches().findOne({ _id: id, organizationId: ctx.user.organizationId });
  if (!d || !canAccessCentre(ctx.user, d.centreId)) notFound();
  const [doc, mail] = await Promise.all([
    collections().documents().findOne({ _id: d.documentId }),
    d.provider === "mock-email" && d.externalId ? collections().outbox().findOne({ externalId: d.externalId }) : null,
  ]);
  const isError = (ERROR_STATUSES as readonly string[]).includes(d.status);
  const canSend = can(ctx.user, "document.send", ctx.organization.settings);
  const newer = await collections().dispatches().countDocuments({ documentId: d.documentId, channel: d.channel, createdAt: { $gt: d.createdAt } });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        back={
          <Link href="/envois" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> {fr.nav.dispatches}
          </Link>
        }
        title={`${fr.channels[d.channel]} — ${d.recipient.name}`}
        description={doc ? `${fr.documentTypes[doc.type]} · version ${d.documentVersion} · ${formatDateTime(d.createdAt)}` : undefined}
        actions={<DispatchStatusBadge status={d.status} className="text-sm" />}
      />

      {isError && d.error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>{d.error.message}</AlertTitle>
          {d.error.hint ? <AlertDescription>{d.error.hint}</AlertDescription> : null}
        </Alert>
      ) : null}
      {newer > 0 ? (
        <Alert>
          <Info aria-hidden />
          <AlertDescription>Cet envoi a été suivi d&apos;un renvoi. Consultez l&apos;historique du document pour la dernière tentative.</AlertDescription>
        </Alert>
      ) : null}

      {canSend ? (
        <DispatchActions
          id={d._id}
          canRetry={newer === 0 && (isError || d.status === "cancelled" || d.status === "opened" || d.status === "delivered" || d.status === "posted" || d.status === "sent")}
          canCancel={d.channel === "COURRIER" && ["queued", "awaiting_confirmation", "sent", "action_required"].includes(d.status)}
          canAcknowledge={isError && !d.acknowledged}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2 rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">Détails</h2>
          <p>
            <span className="text-muted-foreground">Destinataire : </span>
            {d.recipient.name}
          </p>
          {d.recipient.email ? (
            <p>
              <span className="text-muted-foreground">E-mail : </span>
              {d.recipient.email}
            </p>
          ) : null}
          {d.recipient.address ? (
            <p className="whitespace-pre-line">
              <span className="text-muted-foreground">Adresse : </span>
              {[d.recipient.address.line1, d.recipient.address.line2, `${d.recipient.address.postalCode} ${d.recipient.address.city}`].filter(Boolean).join(", ")}
            </p>
          ) : null}
          {d.costCents !== null ? (
            <p>
              <span className="text-muted-foreground">Coût : </span>
              {euros(d.costCents, d.currency ?? "EUR")}
            </p>
          ) : null}
          {d.secureLinkId ? (
            <p className="flex items-center gap-1">
              <Lock className="size-3.5" aria-hidden /> Lien sécurisé à durée limitée
            </p>
          ) : null}
          <p className="text-muted-foreground">
            Prestataire : {d.provider.startsWith("mock") ? "simulation (mode démo)" : d.provider === "resend" ? "Resend" : "Pingen"}
            {d.externalId ? ` · réf. ${d.externalId.slice(0, 18)}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/documents/${d.documentId}`}>Voir le document</Link>
            </Button>
            {d.pdfKey ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/envois/${d._id}/pdf`} target="_blank" rel="noreferrer">
                  <FileDown aria-hidden /> PDF postal envoyé
                </a>
              </Button>
            ) : null}
            {d.prescriberId ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/prescripteurs/${d.prescriberId}`}>Fiche du prescripteur</Link>
              </Button>
            ) : null}
          </div>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Historique</h2>
          <ol className="space-y-3 border-l pl-4">
            {[...d.events].reverse().map((e, i) => (
              <li key={i} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" aria-hidden />
                <span className="block font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(e.at)} · {e.source === "webhook" ? "notification du prestataire" : e.source === "poll" ? "vérification automatique" : e.source === "mock" ? "simulation" : "application"}
                </span>
                {e.detail ? <span className="block text-xs">{e.detail}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {mail ? (
        <section className="space-y-2 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">E-mail simulé (mode démo)</h2>
          <p className="text-sm text-muted-foreground">
            Objet : <strong>{mail.subject}</strong> — envoyé à {mail.to.join(", ")}
          </p>
          <iframe title="Aperçu de l'e-mail simulé" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={mail.html} className="h-[560px] w-full rounded-lg border bg-white" />
        </section>
      ) : null}
    </div>
  );
}
