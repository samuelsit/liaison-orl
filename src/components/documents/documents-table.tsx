"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardList, FileStack, FileText, ListChecks, Loader2, Mail, Mailbox, Send, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, NoResultsState } from "@/components/layout/empty-state";
import { ListRowContainer } from "@/components/layout/list-row";
import { SelectionBar } from "@/components/layout/sticky-action-bar";
import { PAGE_STEP } from "@/components/dispatches/list-utils";
import { useCreateDocument } from "@/hooks/use-create-document";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { fr } from "@/lib/i18n/fr";
import { dispFr, formatEuros } from "@/lib/i18n/dispatch";
import { cn } from "@/lib/utils";
import { bulkSendAction, previewBulkSendAction, type BulkPreviewItem } from "@/server/actions/dispatch";
import type { BulkResult } from "@/server/services/dispatch";
import type { DocumentListItem } from "@/server/services/hydrate";
import { activeSecondaryFilters, DocumentsToolbar, type DocumentFilterState, type DocumentStatusCounts } from "./document-search";
import { DocumentRows, type DocumentViewer } from "./document-rows";

/**
 * Colle la barre d'outils sous l'en-tête (≥ sm) et publie sa hauteur dans `--list-sticky-top`
 * pour que les sous-titres de période de la liste se collent juste dessous.
 */
function useStickyToolbar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const sync = () => {
      const sticky = getComputedStyle(el).position === "sticky";
      parent.style.setProperty("--list-sticky-top", sticky ? `calc(3.5rem + ${el.offsetHeight}px)` : "3.5rem");
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ref;
}

/** Liste des documents : barre d'outils, lignes groupées par période, sélection et envoi groupé. */
export function DocumentsTable({
  items,
  viewer,
  filters,
  counts,
  total,
  multiCentre,
}: {
  items: DocumentListItem[];
  viewer: DocumentViewer;
  filters: DocumentFilterState;
  counts: DocumentStatusCounts;
  /** Nombre total de documents pour les filtres actuels (la liste peut être tronquée). */
  total: number;
  multiCentre: boolean;
}) {
  const router = useRouter();
  const { update, pending: filtering } = useUrlFilters({ resetKeys: ["n"] });
  const toolbarRef = useStickyToolbar();
  const { create, pending: creating } = useCreateDocument();
  const D = dispFr.documents;

  const sendable = useMemo(() => (viewer.canSend ? items.filter((i) => i.status === "VALIDE").map((i) => i.id) : []), [items, viewer.canSend]);
  const [picked, setPicked] = useState<string[]>([]);
  // Une sélection ne survit pas à un document qui quitte la liste (filtre, envoi).
  const selected = picked.filter((id) => sendable.includes(id));
  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const clear = () => setPicked([]);

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<BulkPreviewItem[] | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [sending, startSend] = useTransition();

  // Échap vide la sélection (hors fenêtre ouverte).
  useEffect(() => {
    if (selected.length === 0 || open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest('[role="dialog"],[role="menu"],[role="listbox"],input,textarea')) return;
      setPicked([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.length, open]);

  function openBulk() {
    setResults(null);
    setPreview(null);
    setOpen(true);
    const ids = [...selected];
    void previewBulkSendAction(ids).then((res) => {
      if (res.ok) setPreview(res.data);
      else setPreview([]);
    });
  }

  function runBulk() {
    startSend(async () => {
      const res = await bulkSendAction(selected);
      if (!res.ok) return void toast.error(res.error);
      setResults(res.data);
      const ok = res.data.filter((r) => r.ok).length;
      toast[ok === res.data.length ? "success" : "warning"](dispFr.bulk.resultToast(ok, res.data.length));
      setPicked([]);
      router.refresh();
    });
  }

  const secondary = activeSecondaryFilters(filters);
  const hasFilters = Boolean(filters.status) || secondary.length > 0;
  const resultLabel = items.length < total ? D.shownOf(items.length, total) : D.count(total);
  const remaining = total - items.length;

  let content: ReactNode = null;
  if (items.length === 0) {
    if (filters.q) {
      content = (
        <NoResultsState
          query={filters.q}
          actions={
            <Button size="sm" variant="outline" onClick={() => update({ q: null })}>
              {D.empty.search}
            </Button>
          }
        />
      );
    } else if (filters.status === "ERREUR" && secondary.length === 0) {
      content = <EmptyState tone="success" icon={<CheckCircle2 aria-hidden />} title={dispFr.envois.empty.errors} description={dispFr.envois.empty.errorsHint} />;
    } else if (hasFilters) {
      const labels = [filters.status ? D.statuses[filters.status] : null, ...secondary.map((s) => s.label)].filter(Boolean).join(", ");
      content = (
        <EmptyState
          icon={<FileStack aria-hidden />}
          title={D.empty.filtered}
          description={D.empty.filteredHint(labels)}
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/documents" scroll={false}>
                {D.empty.clearFilters}
              </Link>
            </Button>
          }
        />
      );
    } else {
      content = (
        <EmptyState
          variant="page"
          icon={<FileStack aria-hidden />}
          title={D.empty.none}
          description={D.empty.noneHint}
          action={
            <>
              <Button variant="outline" disabled={creating} onClick={() => create("COMPTE_RENDU")}>
                <ClipboardList aria-hidden />
                {fr.home.newCompteRendu}
              </Button>
              <Button disabled={creating} onClick={() => create("ADRESSAGE")}>
                <FileText aria-hidden />
                {fr.home.newAdressage}
              </Button>
            </>
          }
        />
      );
    }
  }

  const postalTotal = preview?.reduce((sum, p) => sum + (p.postalCents ?? 0), 0) ?? 0;
  const willSend = preview?.filter((p) => p.channels.length > 0).length ?? selected.length;
  const skipped = preview ? preview.length - willSend : 0;

  return (
    <>
      <div
        ref={toolbarRef}
        className="sm:sticky sm:top-14 sm:z-20 sm:-mx-6 sm:bg-background/85 sm:px-6 sm:py-2 sm:backdrop-blur-md lg:-mx-8 lg:px-8"
      >
        <DocumentsToolbar
          filters={filters}
          counts={counts}
          multiCentre={multiCentre}
          update={update}
        />
      </div>

      {content ?? (
        <div className={cn("space-y-3 transition-opacity duration-150", filtering && "opacity-60")} aria-busy={filtering || undefined}>
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p role="status" aria-live="polite" className="text-meta text-muted-foreground tabular-nums">
              {resultLabel}
            </p>
            {sendable.length > 0 && selected.length < sendable.length ? (
              <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground hover:text-foreground" onClick={() => setPicked(sendable)} aria-label={D.selectValidatedLabel(sendable.length)}>
                <ListChecks aria-hidden />
                {D.selectValidated(sendable.length)}
              </Button>
            ) : null}
          </div>
          <ListRowContainer grouped>
            <DocumentRows items={items} viewer={viewer} grouped animated selection={{ selected, toggle }} />
          </ListRowContainer>
          {remaining > 0 ? (
            <div className="flex justify-center">
              <Button variant="outline" disabled={filtering} onClick={() => update({ n: String(items.length + PAGE_STEP) })}>
                {filtering ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {D.loadMore(Math.min(PAGE_STEP, remaining))}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <SelectionBar count={selected.length} onClear={clear} label={D.selectionLabel}>
        {selected.length < sendable.length ? (
          <Button variant="ghost" size="sm" className="max-sm:hidden" onClick={() => setPicked(sendable)}>
            {D.selectValidated(sendable.length)}
          </Button>
        ) : null}
        <Button size="sm" onClick={openBulk} data-testid="bulk-send">
          <Send aria-hidden />
          {D.sendSelection}
        </Button>
      </SelectionBar>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (sending) return;
          setOpen(o);
          if (!o) setResults(null);
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{results ? dispFr.bulk.resultsTitle : dispFr.bulk.title}</DialogTitle>
            <DialogDescription>{results ? dispFr.bulk.resultToast(results.filter((r) => r.ok).length, results.length) : dispFr.bulk.description}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {results ? (
              <ul className="divide-y rounded-lg border">
                {results.map((r) => (
                  <li key={r.documentId} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                    {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
                    <span className="min-w-0 flex-1">{r.message}</span>
                    <Link href={`/documents/${r.documentId}`} className="shrink-0 text-meta text-brand-fg underline-offset-4 hover:underline">
                      {dispFr.rowActions.viewDocument}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : preview === null ? (
              <div className="space-y-2" aria-busy="true">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {dispFr.bulk.checking}
                </p>
                {selected.slice(0, 4).map((id) => (
                  <Skeleton key={id} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm">
                  {dispFr.bulk.summary(willSend)} {skipped > 0 ? <span className="text-destructive">{dispFr.bulk.skipped(skipped)}</span> : null}
                </p>
                <ul className="divide-y rounded-lg border">
                  {(preview.length ? preview : selected.map((id) => ({ documentId: id }) as BulkPreviewItem)).map((p) => {
                    const item = items.find((i) => i.id === p.documentId);
                    const patient = p.patientLabel || item?.patientName || "—";
                    const prescriber = p.prescriberName ?? item?.prescriberName ?? dispFr.bulk.noPrescriber;
                    return (
                      <li key={p.documentId} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{patient}</p>
                          <p className="flex min-w-0 items-center gap-1 text-meta text-muted-foreground">
                            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{prescriber}</span>
                          </p>
                          {p.problem ? (
                            <p className="mt-0.5 flex items-start gap-1 text-meta text-destructive">
                              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                              {p.channels?.length ? p.problem : `${dispFr.bulk.noChannel} ${p.problem}`}
                            </p>
                          ) : null}
                        </div>
                        <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                          {p.channels?.includes("EMAIL") ? (
                            <Badge tone="outline">
                              <Mail aria-hidden />
                              {fr.preferredChannel.email}
                            </Badge>
                          ) : null}
                          {p.channels?.includes("COURRIER") ? (
                            <Badge tone="outline">
                              <Mailbox aria-hidden />
                              {fr.preferredChannel.courrier}
                            </Badge>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {postalTotal > 0 ? <p className="text-sm font-medium tabular-nums">{dispFr.bulk.postalTotal(formatEuros(postalTotal, preview.find((p) => p.currency)?.currency ?? "EUR"))}</p> : null}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {results ? (
              <>
                <Button variant="outline" asChild>
                  <Link href="/envois">{dispFr.success.allDispatches}</Link>
                </Button>
                <Button onClick={() => setOpen(false)}>{fr.common.close}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                  {fr.common.cancel}
                </Button>
                <Button onClick={runBulk} disabled={sending || willSend === 0} data-testid="bulk-confirm">
                  {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                  {dispFr.bulk.confirm(willSend)}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
