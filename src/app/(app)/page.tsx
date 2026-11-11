import Link from "next/link";
import { Building2, CheckCircle2, CircleAlert, FilePen, LayoutGrid, Mail, Send, SendHorizontal } from "lucide-react";
import { NewDocumentButtons } from "@/components/home/new-document-buttons";
import { CentreOverview } from "@/components/home/centre-overview";
import { homeDateLine, homeGreeting } from "@/components/home/home-format";
import { DocumentList } from "@/components/documents/document-list";
import { DispatchList } from "@/components/dispatches/dispatch-list";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { SectionCard } from "@/components/layout/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { capitalizeName } from "@/lib/text";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";
import { ERROR_STATUSES } from "@/lib/schemas/dispatch";
import { listDocuments } from "@/server/services/documents";
import { hydrateDispatches, hydrateDocuments } from "@/server/services/hydrate";
import { refreshMockDispatches } from "@/server/services/dispatch-status";
import { centreOverview } from "@/server/services/overview";

/** Lignes affichées par section ; les compteurs, eux, sont exacts (countDocuments). */
const ROWS = 5;
const H = shellFr.home;

export default async function HomePage() {
  const ctx = await getUserContext();
  const { user, activeCentre, organization, allCentres, scopeCentreIds: centreIds } = ctx;
  await refreshMockDispatches(user.organizationId).catch(() => undefined);
  // Centre actif, ou tous les centres en vue d'ensemble (administrateurs).
  const scope = { organizationId: user.organizationId, centreId: { $in: centreIds } };
  const errorFilter = { ...scope, status: { $in: [...ERROR_STATUSES] }, acknowledged: { $ne: true } };
  // « Prêts à envoyer » : comptes rendus validés (un adressage validé s'imprime, il ne s'envoie pas).
  const toSend = { ...scope, status: "VALIDE" as const, type: "COMPTE_RENDU" as const };
  const [drafts, validated, recent, errors, draftCount, validCount, errorCount, overview] = await Promise.all([
    listDocuments(user.organizationId, { centreIds, status: "BROUILLON" }, ROWS),
    listDocuments(user.organizationId, { centreIds, status: "VALIDE", type: "COMPTE_RENDU" }, ROWS),
    collections()
      .dispatches()
      .find({ ...scope, status: { $nin: [...ERROR_STATUSES] } })
      .sort({ updatedAt: -1 })
      .limit(ROWS)
      .toArray(),
    collections().dispatches().find(errorFilter).sort({ updatedAt: -1 }).limit(ROWS).toArray(),
    collections()
      .documents()
      .countDocuments({ ...scope, status: "BROUILLON" }),
    collections().documents().countDocuments(toSend),
    collections().dispatches().countDocuments(errorFilter),
    allCentres ? centreOverview(user.organizationId, centreIds) : null,
  ]);
  const centreNames = new Map(ctx.centres.map((c) => [c._id, c.name]));
  const [draftItems, validItems, recentItems, errorItems] = await Promise.all([
    hydrateDocuments(drafts),
    hydrateDocuments(validated),
    hydrateDispatches(recent),
    hydrateDispatches(errors),
  ]);
  const canSend = can(user, "document.send", organization.settings);
  const now = new Date();

  return (
    <PageContainer>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            <time dateTime={now.toISOString().slice(0, 10)} suppressHydrationWarning>
              {homeDateLine(now)}
            </time>
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-display">
            {homeGreeting(capitalizeName(user.firstName), now)}
          </h1>
        </div>
        <p className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full border bg-card px-3 text-meta shadow-xs">
          {allCentres ? (
            <>
              <LayoutGrid className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate font-medium text-foreground">{H.allCentresChip(centreIds.length)}</span>
            </>
          ) : (
            <>
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">{shellFr.sidebar.activeCentre} : </span>
              <span className="truncate font-medium text-foreground">{activeCentre.name}</span>
            </>
          )}
        </p>
      </header>

      <NewDocumentButtons />

      {overview ? (
        <SectionCard
          flush
          title={H.overview.title}
          icon={<LayoutGrid aria-hidden />}
          description={H.overview.description}
        >
          <CentreOverview
            items={overview.map((r) => ({ ...r, id: r.centreId, name: centreNames.get(r.centreId) ?? "" }))}
          />
        </SectionCard>
      ) : null}

      {errorItems.length > 0 ? (
        <SectionCard
          flush
          tone="danger"
          title={fr.home.errors}
          icon={<CircleAlert aria-hidden />}
          description={H.errorsDescription(errorCount)}
          href="/envois?filtre=erreurs"
          count={errorCount}
        >
          <DispatchList items={errorItems} empty="" showCentre={allCentres} />
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard
          flush
          title={fr.home.toFinish}
          icon={<FilePen aria-hidden />}
          href="/documents?statut=BROUILLON"
          count={draftCount}
        >
          {draftItems.length > 0 ? (
            <DocumentList items={draftItems} empty={H.toFinishEmptyTitle} showCentre={allCentres} />
          ) : (
            <EmptyState
              tone="success"
              icon={<CheckCircle2 aria-hidden />}
              title={H.toFinishEmptyTitle}
              description={allCentres ? H.toFinishEmptyDescriptionAll : H.toFinishEmptyDescription}
            />
          )}
        </SectionCard>
        <SectionCard
          flush
          title={fr.home.toSend}
          icon={<SendHorizontal aria-hidden />}
          href="/documents?statut=VALIDE&type=COMPTE_RENDU"
          count={validCount}
          action={
            canSend && validCount >= 2 ? (
              <Button asChild variant="ghost" size="sm" className="-mr-2 text-brand-fg">
                <Link href="/documents?statut=VALIDE&type=COMPTE_RENDU">
                  <Send aria-hidden /> {H.sendAll(validCount)}
                </Link>
              </Button>
            ) : undefined
          }
        >
          {validItems.length > 0 ? (
            <DocumentList items={validItems} empty={H.toSendEmptyTitle} showCentre={allCentres} />
          ) : (
            <EmptyState
              icon={<Send aria-hidden />}
              title={H.toSendEmptyTitle}
              description={H.toSendEmptyDescription}
              action={
                draftCount > 0 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/documents?statut=BROUILLON">{H.seeDrafts}</Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        flush
        title={fr.home.recentlySent}
        icon={<Send aria-hidden />}
        href="/envois"
        description={
          errorCount === 0 ? (
            <Badge tone="success" dot className="mt-1">
              {H.noErrors}
            </Badge>
          ) : undefined
        }
      >
        {recentItems.length > 0 ? (
          <DispatchList items={recentItems} empty="" showCentre={allCentres} />
        ) : (
          <EmptyState icon={<Mail aria-hidden />} title={H.recentEmptyTitle} description={H.recentEmptyDescription} />
        )}
      </SectionCard>
    </PageContainer>
  );
}
