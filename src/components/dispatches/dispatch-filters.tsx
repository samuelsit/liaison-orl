"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterChip, FilterGroup, FilterSearch } from "@/components/layout/filter-bar";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { useUrlFilters, useUrlSearchQuery } from "@/hooks/use-url-filters";
import { dispFr } from "@/lib/i18n/dispatch";
import { cn } from "@/lib/utils";
import { PAGE_STEP } from "./list-utils";

export type DispatchStateFilter = "tous" | "encours" | "erreurs";
export type DispatchChannelFilter = "email" | "courrier" | null;

/**
 * Liste des envois (client) : barre d'outils collante (recherche patient / ORL, état segmenté
 * avec compteurs, menu « Filtres » canal et centres), ligne de résultat et « Afficher plus ».
 * Les anciens liens (?filtre=erreurs|email|courrier|encours) restent valables.
 */
export function DispatchListShell({
  state,
  channel,
  allCentres,
  multiCentre,
  counts,
  shown,
  total,
  children,
}: {
  state: DispatchStateFilter;
  channel: DispatchChannelFilter;
  allCentres: boolean;
  multiCentre: boolean;
  counts: Record<DispatchStateFilter, number>;
  shown: number;
  total: number;
  /** La liste (ou l'état vide), rendue par le serveur. */
  children: ReactNode;
}) {
  const { update, pending } = useUrlFilters({ resetKeys: ["n"] });
  const search = useUrlSearchQuery("q");
  const E = dispFr.envois;
  const bar = useRef<HTMLDivElement>(null);

  // Hauteur de la barre collante → décalage des sous-titres de période (cf. liste des documents).
  useEffect(() => {
    const el = bar.current;
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

  const active = [
    channel ? { key: "canal", label: E.channels[channel] } : null,
    allCentres ? { key: "centres", label: E.allCentres } : null,
  ].filter((f): f is { key: string; label: string } => f !== null);

  return (
    <>
      <div ref={bar} className="sm:sticky sm:top-14 sm:z-20 sm:-mx-6 sm:bg-background/85 sm:px-6 sm:py-2 sm:backdrop-blur-md lg:-mx-8 lg:px-8">
        <FilterBar
          search={
            <FilterSearch
              value={search.value}
              onValueChange={search.setValue}
              pending={search.pending}
              placeholder={E.searchPlaceholder}
              aria-label={E.searchLabel}
            />
          }
          status={
            <SegmentedControl
              size="sm"
              aria-label={E.statusLabel}
              value={state}
              // `filtre=tous` est la valeur par défaut : on la retire de l'URL.
              // Le canal est repris explicitement (un ancien lien ?filtre=email le portait dans « filtre »).
              onValueChange={(v) => update({ filtre: v === "tous" ? null : v, canal: channel })}
              layoutId="envois-state"
            >
              {(Object.keys(E.filters) as DispatchStateFilter[]).map((k) => (
                <SegmentedControlItem key={k} value={k} count={counts[k]}>
                  {E.filters[k]}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          }
          filters={
            <>
              <FilterGroup label={E.channelGroup}>
                {(["email", "courrier"] as const).map((c) => (
                  <FilterChip key={c} active={channel === c} onActiveChange={(on) => update({ canal: on ? c : null, filtre: state === "tous" ? null : state })}>
                    {E.channels[c]}
                  </FilterChip>
                ))}
              </FilterGroup>
              {multiCentre ? (
                <FilterGroup label={E.scopeGroup}>
                  <FilterChip active={allCentres} onActiveChange={(on) => update({ centres: on ? "tous" : null })}>
                    {E.allCentres}
                  </FilterChip>
                </FilterGroup>
              ) : null}
            </>
          }
          activeFilterCount={active.length}
          onResetFilters={() => update({ canal: null, centres: null, filtre: state === "tous" ? null : state })}
        >
          {active.map((f) => (
            <FilterChip key={f.key} active onActiveChange={() => update({ [f.key]: null, filtre: state === "tous" ? null : state })}>
              <span className="sr-only">{dispFr.documents.removeFilterPrefix} </span>
              {f.label}
            </FilterChip>
          ))}
        </FilterBar>
      </div>

      <div className={cn("space-y-3 transition-opacity duration-150", pending && "opacity-60")} aria-busy={pending || undefined}>
        {total > 0 ? (
          <p role="status" aria-live="polite" className="flex min-h-8 items-center text-meta text-muted-foreground tabular-nums">
            {shown < total ? E.shownOf(shown, total) : E.count(total)}
          </p>
        ) : null}
        {children}
        {total > shown ? (
          <div className="flex justify-center">
            <Button variant="outline" disabled={pending} onClick={() => update({ n: String(shown + PAGE_STEP) })}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {dispFr.documents.loadMore(Math.min(PAGE_STEP, total - shown))}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
