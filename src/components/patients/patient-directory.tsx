"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, SearchX, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { FilterBar, FilterSearch } from "@/components/layout/filter-bar";
import { ListRowContainer } from "@/components/layout/list-row";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Shortcut } from "@/components/ui/shortcut";
import { focusedRowId, onListKeyDown, rowLinks } from "@/components/directory/list-navigation";
import { DirectoryPagination } from "@/components/directory/pagination";
import { patientPrefillFromQuery } from "@/components/directory/utils";
import { useCreateDocument } from "@/hooks/use-create-document";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useUrlFilters, useUrlSearchQuery } from "@/hooks/use-url-filters";
import { todayIso } from "@/lib/dates";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import type { DocumentType } from "@/lib/schemas/document";
import { getPrescriberViewAction } from "@/server/actions/prescribers";
import type { PatientView } from "@/server/services/patients";
import type { PrescriberView } from "@/server/services/prescribers";
import { PatientDialog } from "./patient-dialog";
import { PatientRow } from "./patient-row";

const T = dirFr.patients;

type DialogState = {
  open: boolean;
  initial: PatientView | null;
  prescriber: PrescriberView | null;
  prefill?: { lastName?: string; firstName?: string; birthDate?: string };
  key: number;
};

export function PatientDirectory({
  items,
  total,
  page,
  pageSize,
  q,
  scope,
  centres,
  activeCentreId,
  activeCentreName,
  prescriberNames,
  drafts,
  salutations,
  openNew,
}: {
  items: PatientView[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  scope: "active" | "all";
  centres: { id: string; name: string }[];
  activeCentreId: string;
  activeCentreName: string;
  prescriberNames: Record<string, string>;
  /** Brouillon en cours le plus récent par patient (id du document). */
  drafts: Record<string, string>;
  salutations: string[];
  openNew: boolean;
}) {
  const router = useRouter();
  const { update, pending } = useUrlFilters();
  const search = useUrlSearchQuery("q");
  const { create, pending: creating } = useCreateDocument();
  const listRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: openNew, initial: null, prescriber: null, key: 0 });
  const centreName = Object.fromEntries(centres.map((c) => [c.id, c.name]));
  const today = todayIso();

  function openCreate(prefill?: DialogState["prefill"]) {
    setDialog((d) => ({ open: true, initial: null, prescriber: null, prefill, key: d.key + 1 }));
  }

  async function openEdit(p: PatientView) {
    // Le prescripteur habituel doit être chargé : sans lui, l'enregistrement l'effacerait.
    let prescriber: PrescriberView | null = null;
    if (p.usualPrescriberId) {
      prescriber = await getPrescriberViewAction(p.usualPrescriberId);
      if (!prescriber) return void toast.error(fr.common.unknownError);
    }
    setDialog((d) => ({ open: true, initial: p, prescriber, key: d.key + 1 }));
  }

  function createFor(type: DocumentType, p: PatientView) {
    if (!creating) create(type, { patientId: p.id });
  }

  useHotkeys(
    {
      n: (e) => {
        if (dialog.open) return;
        e.preventDefault();
        openCreate(q ? patientPrefillFromQuery(q) : undefined);
      },
    },
    [dialog.open, q],
  );

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      const first = listRef.current ? rowLinks(listRef.current)[0] : undefined;
      if (first) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === "Enter" && items.length === 1 && search.value.trim() === q) {
      e.preventDefault();
      router.push(`/patients/${items[0]!.id}`);
    }
  }

  function onListKey(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.key === "a" || e.key === "c") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const id = focusedRowId(e.target, "/patients/");
      const p = id ? items.find((i) => i.id === id) : undefined;
      if (p) {
        // Raccourci propre à la ligne : prioritaire sur « a » / « c » globaux (document pré-rempli).
        e.preventDefault();
        e.stopPropagation();
        createFor(e.key === "a" ? "ADRESSAGE" : "COMPTE_RENDU", p);
      }
      return;
    }
    onListKeyDown(e);
  }

  const order = q ? T.orderAlpha : T.orderRecent;

  return (
    <PageContainer>
      <PageHeader
        title={T.title}
        description={scope === "all" ? T.subtitleAll : T.subtitleActive(activeCentreName)}
        actions={
          <Button onClick={() => openCreate(q ? patientPrefillFromQuery(q) : undefined)} data-testid="new-patient">
            <Plus aria-hidden /> {T.new}
            <Shortcut keys={["n"]} className="max-md:hidden" />
          </Button>
        }
      />

      <FilterBar
        sticky
        search={
          <FilterSearch
            value={search.value}
            onValueChange={search.setValue}
            pending={search.pending || pending}
            placeholder={T.searchPlaceholder}
            onKeyDown={onSearchKeyDown}
          />
        }
        status={
          centres.length > 1 ? (
            <SegmentedControl<"active" | "all">
              size="sm"
              aria-label={T.scopeLabel}
              value={scope}
              onValueChange={(v) => update({ portee: v === "all" ? "all" : null })}
              layoutId="patient-scope"
            >
              <SegmentedControlItem value="active" title={activeCentreName}>
                {T.scopeActive}
              </SegmentedControlItem>
              <SegmentedControlItem value="all">{T.scopeAll}</SegmentedControlItem>
            </SegmentedControl>
          ) : undefined
        }
        resultCount={total > 0 ? `${T.count(total)} · ${order}` : T.count(0)}
      />

      {items.length === 0 ? (
        q ? (
          <EmptyState
            variant="page"
            icon={<SearchX aria-hidden />}
            title={T.emptySearch(q)}
            description={T.emptySearchHint}
            action={
              <>
                <Button size="sm" variant="outline" onClick={() => search.setValue("")}>
                  {fr.common.clearSearch}
                </Button>
                <Button size="sm" onClick={() => openCreate(patientPrefillFromQuery(q))}>
                  <Plus aria-hidden /> {fr.common.createNamed(q)}
                </Button>
              </>
            }
          />
        ) : (
          <EmptyState
            variant="page"
            icon={<Users aria-hidden />}
            title={T.emptyCentre}
            description={T.emptyCentreHint}
            action={
              <Button onClick={() => openCreate()}>
                <Plus aria-hidden /> {T.new}
              </Button>
            }
          />
        )
      ) : (
        <ListRowContainer ref={listRef} animated onKeyDown={onListKey} aria-busy={creating || undefined}>
          {items.map((p) => (
            <PatientRow
              key={p.id}
              p={p}
              today={today}
              query={q}
              centreName={scope === "all" ? centreName[p.centreId] : undefined}
              prescriberName={p.usualPrescriberId ? prescriberNames[p.usualPrescriberId] : undefined}
              draftId={drafts[p.id]}
              onCreate={createFor}
              onEdit={(row) => void openEdit(row)}
            />
          ))}
        </ListRowContainer>
      )}

      <DirectoryPagination page={page} pageSize={pageSize} total={total} />

      <PatientDialog
        key={dialog.key}
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((d) => ({ ...d, open }));
          if (!open && openNew) update({ nouveau: null });
        }}
        centres={centres}
        activeCentreId={activeCentreId}
        salutations={salutations}
        initial={dialog.initial}
        initialPrescriber={dialog.prescriber}
        prefill={dialog.prefill}
        documentIntents
        onSaved={(p, next) => {
          if (dialog.initial) return void router.refresh();
          if (next) create(next, { patientId: p.id });
          else router.push(`/patients/${p.id}`);
        }}
      />
    </PageContainer>
  );
}
