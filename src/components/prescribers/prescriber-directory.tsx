"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, FileUp, Plus, SearchX, Star, Stethoscope, Building2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { FilterBar, FilterChip, FilterGroup, FilterSearch } from "@/components/layout/filter-bar";
import { ListRowContainer } from "@/components/layout/list-row";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Shortcut } from "@/components/ui/shortcut";
import { copyToClipboard } from "@/components/directory/copy-button";
import { focusedRowId, onListKeyDown, rowLinks } from "@/components/directory/list-navigation";
import { DirectoryPagination } from "@/components/directory/pagination";
import { useCreateDocument } from "@/hooks/use-create-document";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useUrlFilters, useUrlSearchQuery } from "@/hooks/use-url-filters";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { SPECIALTIES } from "@/lib/schemas/prescriber";
import { setPrescriberArchivedAction } from "@/server/actions/prescribers";
import type { PrescriberFilter, PrescriberView } from "@/server/services/prescribers";
import { PrescriberDialog } from "./prescriber-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { PrescriberRow } from "./prescriber-row";

const T = dirFr.prescribers;
const SPECIALTY_FILTERS = SPECIALTIES.filter((s) => s !== "Autre");

export function PrescriberDirectory({
  items,
  total,
  page,
  pageSize,
  q,
  filter,
  specialty,
  activeCentreName,
  centres,
  salutations,
  canImport,
  canArchive,
  canEdit,
  openNew,
}: {
  items: PrescriberView[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  filter: PrescriberFilter;
  specialty: string | null;
  activeCentreName: string;
  centres: { id: string; name: string }[];
  salutations: string[];
  canImport: boolean;
  canArchive: boolean;
  canEdit: boolean;
  openNew: boolean;
}) {
  const router = useRouter();
  const { href, update, pending } = useUrlFilters();
  const search = useUrlSearchQuery("q");
  const { create, pending: creating } = useCreateDocument();
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<{ open: boolean; initial: PrescriberView | null; prefill?: { lastName?: string } }>({
    open: openNew && canEdit,
    initial: null,
  });
  const [csvOpen, setCsvOpen] = useState(false);

  function openCreate(prefill?: { lastName?: string }) {
    setDialog({ open: true, initial: null, prefill });
  }

  useHotkeys(
    {
      n: (e) => {
        if (!canEdit || dialog.open || csvOpen) return;
        e.preventDefault();
        openCreate(q ? { lastName: q } : undefined);
      },
    },
    [canEdit, dialog.open, csvOpen, q],
  );

  function createFor(type: "ADRESSAGE" | "COMPTE_RENDU", p: PrescriberView) {
    if (creating || p.archived) return;
    create(type, { prescriberId: p.id });
  }

  function archive(p: PrescriberView, archived: boolean) {
    startTransition(async () => {
      const res = await setPrescriberArchivedAction(p.id, archived);
      if (!res.ok) return void toast.error(res.error);
      toast.success(archived ? T.archived : T.restored, {
        action: {
          label: fr.common.undo,
          onClick: () => {
            void setPrescriberArchivedAction(p.id, !archived).then(() => router.refresh());
          },
        },
      });
      router.refresh();
    });
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      const first = listRef.current ? rowLinks(listRef.current)[0] : undefined;
      if (first) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === "Enter" && items.length === 1 && search.value.trim() === q) {
      e.preventDefault();
      router.push(`/prescripteurs/${items[0]!.id}`);
    }
  }

  function onListKey(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.key === "a" || e.key === "c") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const id = focusedRowId(e.target, "/prescripteurs/");
      const p = id ? items.find((i) => i.id === id) : undefined;
      if (p && !p.archived) {
        // Raccourci propre à la ligne : prioritaire sur « a » / « c » globaux (sans préremplissage).
        e.preventDefault();
        e.stopPropagation();
        createFor(e.key === "a" ? "ADRESSAGE" : "COMPTE_RENDU", p);
      }
      return;
    }
    onListKeyDown(e);
  }

  const viewAll = (
    <Button size="sm" variant="outline" asChild>
      <Link href={href({ filtre: null, q: null, specialite: null })}>{T.seeAll}</Link>
    </Button>
  );

  let empty: React.ReactNode = null;
  if (items.length === 0) {
    if (q) {
      empty = (
        <EmptyState
          variant="page"
          icon={<SearchX aria-hidden />}
          title={fr.common.noResultsFor(q)}
          description={T.emptySearchHint}
          action={
            <>
              <Button size="sm" variant="outline" onClick={() => search.setValue("")}>
                {fr.common.clearSearch}
              </Button>
              {canEdit && filter !== "archived" ? (
                <Button size="sm" onClick={() => openCreate({ lastName: q })}>
                  <Plus aria-hidden /> {fr.common.createNamed(q)}
                </Button>
              ) : null}
            </>
          }
        />
      );
    } else if (filter === "favorites") {
      empty = <EmptyState variant="page" icon={<Star aria-hidden />} title={T.emptyFavorites} description={T.emptyFavoritesHint} action={viewAll} />;
    } else if (filter === "centre") {
      empty = <EmptyState variant="page" icon={<Building2 aria-hidden />} title={T.emptyCentre(activeCentreName)} description={T.emptyCentreHint} action={viewAll} />;
    } else if (filter === "archived") {
      empty = <EmptyState variant="page" icon={<Archive aria-hidden />} title={T.emptyArchived} description={T.emptyArchivedHint} />;
    } else if (specialty) {
      empty = (
        <EmptyState
          variant="page"
          icon={<SearchX aria-hidden />}
          title={fr.common.noResults}
          description={fr.common.noResultsHint}
          action={
            <Button size="sm" variant="outline" onClick={() => update({ specialite: null })}>
              {fr.common.resetFilters}
            </Button>
          }
        />
      );
    } else {
      empty = (
        <EmptyState
          variant="page"
          icon={<Stethoscope aria-hidden />}
          title={T.emptyAll}
          description={T.emptyAllHint}
          action={
            canEdit ? (
              <Button onClick={() => openCreate()}>
                <Plus aria-hidden /> {T.new}
              </Button>
            ) : undefined
          }
        />
      );
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={T.title}
        description={T.subtitle}
        actions={
          <>
            {canImport ? (
              <Button variant="outline" onClick={() => setCsvOpen(true)}>
                <FileUp aria-hidden /> {T.import}
              </Button>
            ) : null}
            {canEdit ? (
              <Button onClick={() => openCreate(q ? { lastName: q } : undefined)} data-testid="new-prescriber">
                <Plus aria-hidden /> {T.new}
                <Shortcut keys={["n"]} className="max-md:hidden" />
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        sticky
        search={
          <FilterSearch
            data-testid="prescriber-search"
            value={search.value}
            onValueChange={search.setValue}
            pending={search.pending || pending}
            placeholder={T.searchPlaceholder}
            onKeyDown={onSearchKeyDown}
          />
        }
        status={
          // « Archivés » (menu Filtres) est une vue à part : aucun segment n'est alors actif.
          <SegmentedControl<PrescriberFilter>
            size="sm"
            aria-label={T.filtersLabel}
            value={filter}
            onValueChange={(v) => update({ filtre: v === "all" ? null : v })}
            layoutId="prescriber-filter"
          >
            <SegmentedControlItem value="all">{T.filters.all}</SegmentedControlItem>
            <SegmentedControlItem value="favorites">{T.filters.favorites}</SegmentedControlItem>
            <SegmentedControlItem value="centre" title={activeCentreName}>
              {T.filters.centre}
            </SegmentedControlItem>
          </SegmentedControl>
        }
        filters={
          <>
            <FilterGroup label={T.specialtyFilter}>
              {SPECIALTY_FILTERS.map((s) => (
                <FilterChip key={s} active={specialty === s} onActiveChange={(on) => update({ specialite: on ? s : null })}>
                  {s}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup label={T.stateFilter}>
              <FilterChip
                active={filter === "archived"}
                icon={<Archive aria-hidden />}
                onActiveChange={(on) => update({ filtre: on ? "archived" : null })}
              >
                {T.filters.archived}
              </FilterChip>
            </FilterGroup>
          </>
        }
        activeFilterCount={(specialty ? 1 : 0) + (filter === "archived" ? 1 : 0)}
        onResetFilters={() => update({ specialite: null, filtre: filter === "archived" ? null : filter })}
        resultCount={T.count(total)}
      />

      {empty ?? (
        <ListRowContainer ref={listRef} animated onKeyDown={onListKey} aria-busy={creating || undefined}>
          {items.map((p) => (
            <PrescriberRow
              key={p.id}
              p={p}
              query={q}
              canEdit={canEdit}
              canArchive={canArchive}
              onCreate={(type, row) => createFor(type, row)}
              onEdit={(row) => setDialog({ open: true, initial: row })}
              onArchive={archive}
              onCopyEmail={(row) => void copyToClipboard(row.email, T.copied.email)}
            />
          ))}
        </ListRowContainer>
      )}

      <DirectoryPagination page={page} pageSize={pageSize} total={total} />

      <PrescriberDialog
        key={dialog.initial?.id ?? `new-${dialog.prefill?.lastName ?? ""}`}
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((d) => ({ ...d, open }));
          if (!open && openNew) update({ nouveau: null });
        }}
        centres={centres}
        salutations={salutations}
        initial={dialog.initial}
        prefill={dialog.prefill}
        onSaved={() => router.refresh()}
      />
      {canImport ? <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} onDone={() => router.refresh()} /> : null}
    </PageContainer>
  );
}
