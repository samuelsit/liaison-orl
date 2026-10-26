import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, FileText, History, Mail, Mailbox, TriangleAlert } from "lucide-react";
import { DISPATCH_STATUS_TONE, DispatchStatusBadge, DocumentStatusBadge } from "@/components/documents/status-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { ListRow, ListRowGroup, ListRowIcon } from "@/components/layout/list-row";
import { RelativeTime } from "@/components/layout/relative-time";
import { SectionCard } from "@/components/layout/section-card";
import { badgeVariants } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/dates";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";
import type { DispatchListItem, DocumentListItem } from "@/server/services/hydrate";
import { buildActivity, type ActivityEntry } from "./activity";

const T = dirFr.activity;

/** Puce d'un envoi sous son document : canal, statut, date ; lien vers le suivi de l'envoi. */
function DispatchChip({ d }: { d: DispatchListItem }) {
  const Icon = d.channel === "EMAIL" ? Mail : Mailbox;
  return (
    <li>
      <Link
        href={`/envois/${d.id}`}
        title={d.error?.message ?? undefined}
        className={cn(
          badgeVariants({ tone: DISPATCH_STATUS_TONE[d.status] }),
          "relative h-6 overflow-visible transition-colors hover:underline hover:underline-offset-2",
          // Cible tactile de 44 px sans agrandir la puce.
          "pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5",
        )}
      >
        <Icon aria-hidden />
        <span className="sr-only">{fr.channels[d.channel]} : </span>
        {fr.dispatchStatus[d.status]}
        <span aria-hidden>·</span>
        <span className="tabular-nums" suppressHydrationWarning>
          {formatShortDate(d.updatedAt)}
        </span>
      </Link>
    </li>
  );
}

function Entry({ entry, context }: { entry: ActivityEntry; context: "patient" | "prescriber" }) {
  const { doc, dispatches } = entry;
  const Icon = doc.type === "ADRESSAGE" ? FileText : ClipboardList;
  const type = fr.documentTypesShort[doc.type];
  const title = context === "patient" ? type : (doc.patientName ?? T.untitledPatient);
  const subtitle = (context === "patient" ? [doc.prescriberName, doc.authorName] : [type, doc.authorName]).filter(Boolean).join(" · ");
  return (
    <li className="group/row relative px-4 py-2.5 transition-colors duration-150 focus-within:bg-muted/60 hover:bg-muted/60">
      <div className="grid min-h-9 grid-cols-[auto_minmax(0,1fr)_auto] items-center">
        <Link
          href={`/documents/${doc.id}`}
          className="col-start-2 row-start-1 min-w-0 outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid"
        >
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          {subtitle ? <span className="block truncate text-meta text-muted-foreground">{subtitle}</span> : null}
        </Link>
        <div className="col-start-1 row-start-1 mr-3 flex">
          <ListRowIcon>
            <Icon />
          </ListRowIcon>
        </div>
        <div className="col-start-3 row-start-1 ml-3 flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <DocumentStatusBadge status={doc.status} />
          <RelativeTime date={doc.updatedAt} className="text-xs whitespace-nowrap text-muted-foreground sm:w-20 sm:text-right" />
        </div>
      </div>
      {dispatches.length > 0 ? (
        <ul aria-label={fr.nav.dispatches} className="relative z-10 mt-2 ml-11 flex w-fit max-w-[calc(100%-2.75rem)] flex-wrap gap-1.5 pointer-coarse:gap-y-3">
          {dispatches.map((d) => (
            <DispatchChip key={d.id} d={d} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Fil d'activité d'une fiche : documents groupés par mois avec leurs envois en puces
 * (erreurs d'abord), sans répéter le nom de la fiche sur chaque ligne. Les envois dont
 * le document n'est pas chargé apparaissent dans « Autres envois ».
 */
export function ActivityTimeline({
  docs,
  dispatches,
  context,
  count,
  emptyAction,
}: {
  docs: DocumentListItem[];
  dispatches: DispatchListItem[];
  /** Fiche affichée : le titre de chaque ligne est l'autre partie (type de document ou patient). */
  context: "patient" | "prescriber";
  /** Nombre total de documents (peut dépasser la liste chargée). */
  count?: number;
  emptyAction?: ReactNode;
}) {
  const { groups, orphans } = buildActivity(docs, dispatches);
  const empty = groups.length === 0 && orphans.length === 0;
  return (
    <SectionCard flush title={T.title} icon={<History />} count={count ?? docs.length}>
      {empty ? (
        <EmptyState icon={<History aria-hidden />} title={T.empty} description={T.emptyHint} action={emptyAction} />
      ) : (
        <div className="[--list-sticky-top:3.5rem]">
          {groups.map((g) => (
            <ListRowGroup key={g.key} label={g.label}>
              {g.entries.map((e) => (
                <Entry key={e.doc.id} entry={e} context={context} />
              ))}
            </ListRowGroup>
          ))}
          {orphans.length > 0 ? (
            <ListRowGroup label={T.otherDispatches}>
              {orphans.map((d) => {
                const Icon = d.error ? TriangleAlert : d.channel === "EMAIL" ? Mail : Mailbox;
                return (
                  <ListRow
                    key={d.id}
                    href={`/envois/${d.id}`}
                    leading={
                      <ListRowIcon tone={d.error ? "danger" : "neutral"}>
                        <Icon />
                      </ListRowIcon>
                    }
                    title={context === "patient" ? `${fr.channels[d.channel]} → ${d.recipientName}` : (d.patientName ?? "—")}
                    subtitle={[d.documentType ? fr.documentTypesShort[d.documentType] : null, d.error?.message].filter(Boolean).join(" · ")}
                    badge={<DispatchStatusBadge status={d.status} />}
                    date={d.updatedAt}
                  />
                );
              })}
            </ListRowGroup>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
