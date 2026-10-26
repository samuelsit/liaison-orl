"use client";

import type { ReactNode } from "react";
import { FilterBar, FilterChip, FilterGroup, FilterSearch } from "@/components/layout/filter-bar";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { useUrlFilters, useUrlSearchQuery } from "@/hooks/use-url-filters";
import { fr } from "@/lib/i18n/fr";
import { dispFr } from "@/lib/i18n/dispatch";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, type DocumentStatus, type DocumentType } from "@/lib/schemas/document";

export interface DocumentFilterState {
  status: DocumentStatus | null;
  type: DocumentType | null;
  mine: boolean;
  allCentres: boolean;
  q: string;
}

export type DocumentStatusCounts = Record<DocumentStatus | "all", number>;

/** Libellés des filtres secondaires actifs (type, « Mes documents », « Tous mes centres »). */
export function activeSecondaryFilters(f: Pick<DocumentFilterState, "type" | "mine" | "allCentres">): { key: string; label: string }[] {
  const D = dispFr.documents;
  const list: { key: string; label: string }[] = [];
  if (f.type) list.push({ key: "type", label: fr.documentTypesShort[f.type] });
  if (f.mine) list.push({ key: "auteur", label: D.mine });
  if (f.allCentres) list.push({ key: "centres", label: D.allCentres });
  return list;
}

/** Recherche par patient synchronisée avec l'URL (`?q=`). */
export function DocumentSearch({ className }: { className?: string }) {
  const search = useUrlSearchQuery("q");
  return (
    <FilterSearch
      value={search.value}
      onValueChange={search.setValue}
      pending={search.pending}
      placeholder={dispFr.documents.searchPlaceholder}
      aria-label={dispFr.documents.searchLabel}
      className={className}
    />
  );
}

/**
 * Barre d'outils de la liste des documents : recherche, statut segmenté avec compteurs,
 * menu « Filtres » (type, mes documents, tous mes centres) et puces des filtres actifs.
 * Les paramètres d'URL restent ceux d'origine (statut, type, auteur=moi, centres=tous, q).
 */
export function DocumentsToolbar({
  filters,
  counts,
  multiCentre,
  resultCount,
  actions,
  update,
}: {
  filters: DocumentFilterState;
  counts: DocumentStatusCounts;
  multiCentre: boolean;
  resultCount?: ReactNode;
  actions?: ReactNode;
  /** `update` de useUrlFilters (partagé avec la liste pour l'état de chargement). */
  update: ReturnType<typeof useUrlFilters>["update"];
}) {
  const D = dispFr.documents;
  const active = activeSecondaryFilters(filters);
  return (
    <FilterBar
      search={<DocumentSearch />}
      status={
        <SegmentedControl
          size="sm"
          aria-label={D.statusLabel}
          value={filters.status ?? "all"}
          onValueChange={(v) => update({ statut: v === "all" ? null : v })}
          layoutId="documents-status"
        >
          <SegmentedControlItem value="all" count={counts.all}>
            {D.all}
          </SegmentedControlItem>
          {DOCUMENT_STATUSES.map((s) => (
            <SegmentedControlItem key={s} value={s} count={counts[s]}>
              {D.statuses[s]}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      }
      filters={
        <>
          <FilterGroup label={D.typeGroup}>
            {DOCUMENT_TYPES.map((t) => (
              <FilterChip key={t} active={filters.type === t} onActiveChange={(on) => update({ type: on ? t : null })}>
                {fr.documentTypesShort[t]}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label={D.scopeGroup}>
            <FilterChip active={filters.mine} onActiveChange={(on) => update({ auteur: on ? "moi" : null })}>
              {D.mine}
            </FilterChip>
            {multiCentre ? (
              <FilterChip active={filters.allCentres} onActiveChange={(on) => update({ centres: on ? "tous" : null })}>
                {D.allCentres}
              </FilterChip>
            ) : null}
          </FilterGroup>
        </>
      }
      activeFilterCount={active.length}
      onResetFilters={() => update({ type: null, auteur: null, centres: null })}
      resultCount={resultCount}
      actions={actions}
    >
      {active.length > 0
        ? active.map((f) => (
            // Puce active : un clic retire le filtre.
            <FilterChip key={f.key} active onActiveChange={() => update({ [f.key]: null })}>
              <span className="sr-only">{D.removeFilterPrefix} </span>
              {f.label}
            </FilterChip>
          ))
        : null}
    </FilterBar>
  );
}
