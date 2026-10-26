import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, Mail, MapPin, Phone, Send, TriangleAlert } from "lucide-react";
import { ActivityTimeline } from "@/components/directory/activity-timeline";
import { ContactLine, ContactLines } from "@/components/directory/contact-line";
import { CreateDocumentButton } from "@/components/directory/create-document-actions";
import { personInitials } from "@/components/directory/utils";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader, PageHeaderTile } from "@/components/layout/page-header";
import { RelativeTime } from "@/components/layout/relative-time";
import { SectionCard } from "@/components/layout/section-card";
import { StatTile, StatTiles } from "@/components/layout/stat-tile";
import { FavoriteToggle } from "@/components/prescribers/favorite-toggle";
import { addressLines, channelReadiness, formatPrescriberName } from "@/components/prescribers/format";
import { EditPrescriberButton, PrescriberActions, PrescriberEditProvider } from "@/components/prescribers/prescriber-actions";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";
import { listDocuments } from "@/server/services/documents";
import { hydrateDispatches, hydrateDocuments } from "@/server/services/hydrate";
import { toPrescriberView } from "@/server/services/prescribers";

const T = dirFr.prescribers;
const LIMIT = 30;

/** Titre d'onglet : le nom du prescripteur (pas une donnée patient). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getUserContext();
  const doc = await collections()
    .prescribers()
    .findOne({ _id: id, organizationId: ctx.user.organizationId }, { projection: { civility: 1, firstName: 1, lastName: 1 } });
  return { title: doc ? formatPrescriberName(doc) : "Fiche prescripteur" };
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="text-sm wrap-break-word text-foreground">{children}</dd>
    </div>
  );
}

function ReadinessLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CircleCheck : TriangleAlert;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok ? "text-success-foreground" : "text-warning-foreground")} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export default async function PrescriberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const organizationId = ctx.user.organizationId;
  const doc = await collections().prescribers().findOne({ _id: id, organizationId });
  if (!doc) notFound();
  const p = toPrescriberView(doc, ctx.user.id);
  const centreIds = ctx.centres.map((c) => c._id);
  const docScope = { organizationId, centreId: { $in: centreIds }, prescriberId: id };
  // Lectures seules : liste récente + compteurs exacts pour les indicateurs.
  const [docs, dispatches, docCount, patientIds] = await Promise.all([
    listDocuments(organizationId, { centreIds, prescriberId: id }, LIMIT),
    collections().dispatches().find({ organizationId, centreId: { $in: centreIds }, prescriberId: id }).sort({ createdAt: -1 }).limit(LIMIT).toArray(),
    collections().documents().countDocuments(docScope),
    collections().documents().distinct("patientId", { ...docScope, patientId: { $ne: null } }),
  ]);
  const [docItems, dispatchItems] = await Promise.all([hydrateDocuments(docs), hydrateDispatches(dispatches)]);
  const settings = ctx.organization.settings;
  const canEdit = can(ctx.user, "prescriber.edit", settings);
  const name = formatPrescriberName(p);
  const centreNames = ctx.centres.filter((c) => p.centreIds.includes(c._id)).map((c) => c.name);
  const lines = addressLines(p.address);
  const readiness = channelReadiness(p);
  const lastDispatchAt = dispatches[0]?.createdAt ?? null;
  const number = new Intl.NumberFormat("fr-FR");

  return (
    <PrescriberEditProvider
      prescriber={p}
      centres={ctx.centres.map((c) => ({ id: c._id, name: c.name }))}
      salutations={settings.documents.salutations}
      canEdit={canEdit}
    >
      <PageContainer className={cn(!p.archived && "max-sm:pb-24")}>
        <PageHeader
          breadcrumbs={[{ label: fr.nav.prescribers, href: "/prescripteurs" }, { label: name }]}
          leading={<PageHeaderTile>{personInitials(p.firstName, p.lastName)}</PageHeaderTile>}
          title={name}
          meta={
            <>
              <FavoriteToggle id={p.id} favorite={p.isFavorite} name={name} />
              {p.archived ? <Badge tone="neutral">{T.archivedBadge}</Badge> : null}
            </>
          }
          description={[p.specialty, p.practiceName, p.address.city].filter(Boolean).join(" · ") || undefined}
          actions={<PrescriberActions prescriber={p} canArchive={can(ctx.user, "prescriber.archive", settings)} />}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:items-start">
          <SectionCard title={T.contact} className="lg:col-start-2 lg:row-start-1">
            <ContactLines>
              {p.email ? (
                <ContactLine icon={<Mail />} copy={{ value: p.email, label: T.copyLabel.email(name), message: T.copied.email }}>
                  <a href={`mailto:${p.email}`} className="text-brand-fg underline-offset-4 hover:underline">
                    {p.email}
                  </a>
                </ContactLine>
              ) : (
                <ContactLine icon={<Mail />} tone="warning">
                  {canEdit ? (
                    <EditPrescriberButton variant="link" size="sm" className="h-auto px-0">
                      {T.addEmail}
                    </EditPrescriberButton>
                  ) : (
                    <span className="text-warning-foreground">{T.noEmail}</span>
                  )}
                </ContactLine>
              )}
              {p.phone ? (
                <ContactLine icon={<Phone />} copy={{ value: p.phone, label: T.copyLabel.phone(name), message: T.copied.phone }}>
                  <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="text-brand-fg tabular-nums underline-offset-4 hover:underline">
                    {p.phone}
                  </a>
                </ContactLine>
              ) : canEdit ? (
                <ContactLine icon={<Phone />}>
                  <EditPrescriberButton variant="link" size="sm" className="h-auto px-0 text-muted-foreground">
                    {T.addPhone}
                  </EditPrescriberButton>
                </ContactLine>
              ) : null}
              {readiness.post ? (
                <ContactLine icon={<MapPin />} copy={{ value: lines.join("\n"), label: T.copyLabel.address(name), message: T.copied.address }}>
                  <address className="not-italic whitespace-pre-line">{lines.join("\n")}</address>
                </ContactLine>
              ) : (
                <ContactLine icon={<MapPin />} tone="warning">
                  {lines.length > 1 ? <address className="mb-1 not-italic whitespace-pre-line">{lines.join("\n")}</address> : null}
                  {canEdit ? (
                    <EditPrescriberButton variant="link" size="sm" className="h-auto px-0">
                      {T.completeAddress}
                    </EditPrescriberButton>
                  ) : (
                    <span className="text-warning-foreground">{T.noAddress}</span>
                  )}
                </ContactLine>
              )}
            </ContactLines>
          </SectionCard>

          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <StatTiles className="grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3">
              <StatTile label={T.stats.documents} value={number.format(docCount)} />
              <StatTile label={T.stats.patients} value={number.format(patientIds.length)} />
              <StatTile
                label={T.stats.lastDispatch}
                value={lastDispatchAt ? <RelativeTime date={lastDispatchAt} /> : T.stats.never}
                icon={<Send />}
                className="col-span-2 sm:col-span-1"
              />
            </StatTiles>
            <ActivityTimeline
              docs={docItems}
              dispatches={dispatchItems}
              context="prescriber"
              count={docCount}
              emptyAction={
                p.archived ? undefined : (
                  <CreateDocumentButton type="ADRESSAGE" context={{ prescriberId: p.id }} size="sm" variant="outline" />
                )
              }
            />
          </div>

          <SectionCard title={T.sending} className="lg:col-start-2 lg:row-start-2">
            <div className="space-y-5">
              <ul className="space-y-1.5" aria-label={T.readiness.title}>
                <ReadinessLine ok={readiness.email}>{readiness.email ? T.readiness.emailReady : T.readiness.emailMissing}</ReadinessLine>
                <ReadinessLine ok={readiness.post}>{readiness.post ? T.readiness.postReady : T.readiness.postMissing}</ReadinessLine>
              </ul>
              <dl className="space-y-3">
                <Detail label={T.fields.preferredChannel}>
                  {fr.preferredChannel[p.preferredChannel]}
                  {readiness.preferredUsable ? null : (
                    <span className="ml-1.5 text-meta text-warning-foreground">({T.channelPreferredUnusable.toLowerCase()})</span>
                  )}
                </Detail>
                <Detail label={T.fields.salutation}>
                  {p.salutation || (
                    <>
                      {settings.documents.defaultSalutation} <span className="text-muted-foreground">{T.defaultSuffix}</span>
                    </>
                  )}
                </Detail>
                {p.rpps ? (
                  <Detail label={T.fields.rpps}>
                    <span className="tabular-nums">{p.rpps}</span>
                  </Detail>
                ) : null}
                <Detail label={T.fields.centres}>
                  {centreNames.length ? (
                    <span className="flex flex-wrap gap-1.5 pt-0.5">
                      {centreNames.map((c) => (
                        <Badge key={c} tone="outline">
                          {c}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{T.noCentre}</span>
                  )}
                </Detail>
              </dl>
              {p.notes ? (
                <div className="space-y-1">
                  <p className="text-meta text-muted-foreground">{T.fields.notes}</p>
                  <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-line">{p.notes}</p>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </PageContainer>
    </PrescriberEditProvider>
  );
}
