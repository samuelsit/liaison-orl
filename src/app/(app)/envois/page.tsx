import type { Metadata } from "next";
import Link from "next/link";
import type { Filter } from "mongodb";
import { CheckCircle2, Send, SearchX } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ListRowContainer } from "@/components/layout/list-row";
import { Button } from "@/components/ui/button";
import { DispatchList } from "@/components/dispatches/dispatch-list";
import { AutoRefresh } from "@/components/dispatches/auto-refresh";
import { DispatchListShell, type DispatchChannelFilter, type DispatchStateFilter } from "@/components/dispatches/dispatch-filters";
import { isLiveStatus } from "@/components/dispatches/dispatch-steps";
import { pageSize } from "@/components/dispatches/list-utils";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import type { DispatchDoc } from "@/lib/db/types";
import { ERROR_STATUSES } from "@/lib/schemas/dispatch";
import { fr } from "@/lib/i18n/fr";
import { dispFr } from "@/lib/i18n/dispatch";
import { prefixWordsRegex } from "@/lib/text";
import { hydrateDispatches } from "@/server/services/hydrate";
import { refreshMockDispatches } from "@/server/services/dispatch-status";

export const metadata: Metadata = { title: "Envois" };

const IN_PROGRESS = ["queued", "awaiting_confirmation", "sent", "printing"] as const;

export default async function DispatchesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  await refreshMockDispatches(ctx.user.organizationId).catch(() => undefined);
  const sp = await searchParams;
  const E = dispFr.envois;

  // Paramètres : filtre=tous|encours|erreurs, canal=email|courrier (anciens liens : filtre=email|courrier).
  const legacyChannel = sp.filtre === "email" || sp.filtre === "courrier" ? sp.filtre : null;
  const state: DispatchStateFilter = sp.filtre === "erreurs" || sp.filtre === "encours" ? sp.filtre : "tous";
  const channel: DispatchChannelFilter = sp.canal === "email" || sp.canal === "courrier" ? sp.canal : legacyChannel;
  const allCentres = sp.centres === "tous" && ctx.centres.length > 1;
  const q = (sp.q ?? "").slice(0, 80);
  const limit = pageSize(sp.n);

  const base: Filter<DispatchDoc> = {
    organizationId: ctx.user.organizationId,
    centreId: { $in: allCentres ? ctx.centres.map((c) => c._id) : [ctx.activeCentre._id] },
  };
  if (channel) base.channel = channel === "email" ? "EMAIL" : "COURRIER";
  const regex = q ? prefixWordsRegex(q) : null;
  if (regex) {
    // Recherche par patient ou par prescripteur (texte normalisé des fiches, même organisation).
    const [patients, prescribers] = await Promise.all([
      collections().patients().find({ organizationId: ctx.user.organizationId, searchText: regex }, { projection: { _id: 1 } }).limit(200).toArray(),
      collections().prescribers().find({ organizationId: ctx.user.organizationId, searchText: regex }, { projection: { _id: 1 } }).limit(200).toArray(),
    ]);
    base.$or = [{ patientId: { $in: patients.map((p) => p._id) } }, { prescriberId: { $in: prescribers.map((p) => p._id) } }];
  }
  const errorsFilter: Filter<DispatchDoc> = { ...base, status: { $in: [...ERROR_STATUSES] }, acknowledged: { $ne: true } };
  const progressFilter: Filter<DispatchDoc> = { ...base, status: { $in: [...IN_PROGRESS] } };
  const filter = state === "erreurs" ? errorsFilter : state === "encours" ? progressFilter : base;

  const [docs, all, inProgress, errors] = await Promise.all([
    collections().dispatches().find(filter).sort({ updatedAt: -1 }).limit(limit).toArray(),
    collections().dispatches().countDocuments(base),
    collections().dispatches().countDocuments(progressFilter),
    collections().dispatches().countDocuments(errorsFilter),
  ]);
  const items = await hydrateDispatches(docs);
  const counts = { tous: all, encours: inProgress, erreurs: errors };
  const total = counts[state];
  const filtered = Boolean(q || channel || state !== "tous");
  const live = items.some((d) => isLiveStatus(d.status));

  const empty =
    state === "erreurs" && !q ? (
      <EmptyState tone="success" icon={<CheckCircle2 aria-hidden />} title={E.empty.errors} description={E.empty.errorsHint} />
    ) : filtered ? (
      <EmptyState
        icon={<SearchX aria-hidden />}
        title={q ? fr.common.noResultsFor(q) : E.empty.filtered}
        description={E.empty.filteredHint}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href="/envois" scroll={false}>
              {E.empty.seeAll}
            </Link>
          </Button>
        }
      />
    ) : (
      <EmptyState icon={<Send aria-hidden />} title={E.empty.none} description={E.empty.noneHint} />
    );

  return (
    <PageContainer>
      <PageHeader
        title={fr.nav.dispatches}
        description={E.description}
        actions={
          <AutoRefresh
            active={live}
            watch={items.map((d) => ({ id: d.id, status: d.status, channel: d.channel, recipientName: d.recipientName }))}
          />
        }
      />
      <DispatchListShell
        state={state}
        channel={channel}
        allCentres={allCentres}
        multiCentre={ctx.centres.length > 1}
        counts={counts}
        shown={items.length}
        total={total}
      >
        {items.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-xs">{empty}</div>
        ) : (
          <ListRowContainer grouped>
            <DispatchList items={items} grouped canSend={can(ctx.user, "document.send", ctx.organization.settings)} />
          </ListRowContainer>
        )}
      </DispatchListShell>
    </PageContainer>
  );
}
