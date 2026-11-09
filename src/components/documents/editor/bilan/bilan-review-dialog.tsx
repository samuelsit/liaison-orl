"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownToLine, CheckCircle2, ChevronDown, Loader2, TriangleAlert, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Shortcut } from "@/components/ui/shortcut";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudiometryEditor, type AudiometryEditorApi } from "@/components/audiology/audiometry-editor";
import { countAllMeasures } from "@/lib/audiology/calculations";
import { cellText, describeRef, listLowConfidence, refId } from "@/components/audiology/measure-cells";
import type { Audiometry, BilanCondition, Conflict, Measure, MeasureRef } from "@/lib/schemas/audiometry";
import type { AttachmentView } from "@/lib/schemas/attachment";
import { fr } from "@/lib/i18n/fr";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import { BilanOriginalViewer } from "./bilan-original-viewer";
import { FileChip } from "./file-chip";

const R = crFr.review;
const K = crFr.bilan.conflicts;

const LG_QUERY = "(min-width: 1024px)";
function subscribeLg(cb: () => void) {
  const mql = window.matchMedia(LG_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function useIsLg() {
  return useSyncExternalStore(subscribeLg, () => window.matchMedia(LG_QUERY).matches, () => true);
}

/** Conflits entre fichiers : chaque ligne propose les lectures et la réinterprétation d'un fichier. */
function ConflictList({
  conflicts,
  files,
  readOnly,
  onResolve,
  onSetCondition,
}: {
  conflicts: Conflict[];
  files: AttachmentView[];
  readOnly: boolean;
  onResolve: (ref: MeasureRef, attachmentId: string) => void;
  onSetCondition: (attachmentId: string, condition: BilanCondition) => void;
}) {
  const G = crFr.grid;
  const labels = { speechRows: G.speechRows, speechCols: G.speechCols, noiseFields: G.noiseFields };
  const isPercent = (r: MeasureRef) => (r.kind === "speech" && r.key === "maxScore") || (r.kind === "noise" && r.key.endsWith("Score"));
  return (
    <Collapsible defaultOpen className="rounded-xl border border-warning-border/60 bg-warning/40">
      <CollapsibleTrigger className="group/conf flex min-h-11 w-full items-center gap-2 rounded-xl px-4 text-left text-sm font-medium outline-none hover:bg-warning/60 focus-visible:ring-3 focus-visible:ring-ring/40">
        <TriangleAlert className="size-4 shrink-0 text-warning-foreground" aria-hidden />
        {K.title(conflicts.length)}
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]/conf:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-warning-border/40 px-4 pt-3 pb-4">
        <p className="text-meta text-muted-foreground">{K.help}</p>
        <ul className="space-y-3">
          {conflicts.map((c) => {
            const unit = isPercent(c.ref) ? "%" : "dB";
            const all = [c.kept, ...c.others];
            return (
              <li key={refId(c.ref)} className="space-y-1.5">
                <p className="text-sm font-medium">{describeRef(c.ref, labels)}</p>
                <div className="flex flex-wrap gap-2">
                  {all.map((cand) => {
                    const kept = cand.attachmentId === c.kept.attachmentId;
                    const text = cand.noResponse ? "NR" : `${cellText({ value: cand.value, confidence: cand.confidence })} ${unit}`;
                    return (
                      <Button
                        key={cand.attachmentId}
                        type="button"
                        size="sm"
                        variant={kept ? "default" : "outline"}
                        disabled={readOnly}
                        onClick={() => onResolve(c.ref, cand.attachmentId)}
                        title={kept ? K.kept : undefined}
                      >
                        {K.choose(text, cand.fileName)}
                        {kept ? <span className="sr-only"> ({K.kept})</span> : null}
                      </Button>
                    );
                  })}
                </div>
                {!readOnly && c.ref.kind === "curve" ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-meta">
                    {c.others.map((o) => {
                      const f = files.find((x) => x.id === o.attachmentId);
                      if (!f) return null;
                      const aided = f.condition === "aided" || (f.condition === "auto" && f.aidedSheet);
                      return (
                        <button key={o.attachmentId} type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => onSetCondition(f.id, aided ? "unaided" : "aided")}>
                          {aided ? K.interpretUnaided(f.fileName) : K.interpretAided(f.fileName)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Vérification du bilan fusionné en plein écran : fichiers d'origine à gauche (sélecteur
 * de fichier, le fichier source de la case active est affiché), mesures et audiogrammes à
 * droite (onglets sous 1024 px), conflits entre fichiers en tête. Pied fixe : valeur
 * suivante à vérifier, « Plus tard », « Confirmer les mesures » (Ctrl/⌘ + Entrée).
 */
export function BilanReviewDialog({
  open,
  onOpenChange,
  files,
  audiometry,
  conflicts,
  onChange,
  onResolveConflict,
  onSetCondition,
  readOnly,
  confirmed,
  confirming,
  onConfirm,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: AttachmentView[];
  audiometry: Audiometry;
  conflicts: Conflict[];
  onChange: (a: Audiometry) => void;
  onResolveConflict: (ref: MeasureRef, attachmentId: string) => void;
  onSetCondition: (attachmentId: string, condition: BilanCondition) => void;
  readOnly: boolean;
  confirmed: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const isLg = useIsLg();
  const editor = useRef<AudiometryEditorApi>(null);
  const [tab, setTab] = useState<"measures" | "original">("measures");
  const [originalSeen, setOriginalSeen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(files[0]?.id ?? null);
  const low = listLowConfidence(audiometry).length;
  const count = countAllMeasures(audiometry);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  });
  const sourceNames = useMemo(() => Object.fromEntries(files.map((f) => [f.id, f.fileName])), [files]);
  // Un fichier retiré entre-temps : repli sur le premier, sans effet.
  const selected = files.find((f) => f.id === selectedId) ?? files[0] ?? null;

  // Ctrl/⌘ + Entrée confirme les mesures (et non la validation du document) tant que la vérification est ouverte.
  useEffect(() => {
    if (!open || readOnly) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        confirmRef.current();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, readOnly]);

  // La case active vient d'un fichier : l'afficher à gauche.
  const onActiveMeasure = (m: Measure | null) => {
    if (m?.source && files.some((f) => f.id === m.source)) setSelectedId(m.source);
  };

  const editorPane = (
    <div className="space-y-6">
      {conflicts.length ? <ConflictList conflicts={conflicts} files={files} readOnly={readOnly} onResolve={onResolveConflict} onSetCondition={onSetCondition} /> : null}
      <AudiometryEditor ref={editor} value={audiometry} onChange={onChange} readOnly={readOnly} sourceNames={sourceNames} onActiveMeasure={onActiveMeasure} />
    </div>
  );

  const viewer = selected ? (
    <div className="flex h-full min-h-0 flex-col">
      {files.length > 1 ? (
        <div className="shrink-0 border-b px-3 py-2">
          <SegmentedControl<string> aria-label={R.fileSwitcher} value={selected.id} onValueChange={(v) => setSelectedId(v)} size="sm" fullWidth={files.length <= 3}>
            {files.map((f) => (
              <SegmentedControlItem key={f.id} value={f.id} className="max-w-56 min-w-0 px-2" title={f.fileName}>
                <span className="truncate">{f.fileName}</span>
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
      ) : null}
      <BilanOriginalViewer key={selected.id} attachmentId={selected.id} mimeType={selected.mimeType} className="min-h-0 flex-1" />
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="h-dvh max-h-dvh w-screen max-w-none rounded-none border-0 [--chart-surface:var(--popover)] max-sm:max-h-dvh max-sm:rounded-none sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[1600px] sm:rounded-2xl sm:border [&>[data-slot=dialog-handle]]:hidden"
      >
        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base sm:text-lg">{readOnly ? R.readOnlyTitle : R.title}</DialogTitle>
            <DialogDescription className="truncate text-meta max-sm:sr-only">{readOnly ? R.readOnlyDescription : R.description}</DialogDescription>
          </div>
          {files.length === 1 && selected ? <FileChip name={selected.fileName} size={selected.size} mimeType={selected.mimeType} className="max-md:hidden" /> : null}
          {files.length > 1 ? <span className="text-meta text-muted-foreground max-md:hidden">{crFr.bilan.filesCount(files.length)}</span> : null}
          {conflicts.length ? (
            <Badge tone="warning" dot>
              {R.conflictsBadge(conflicts.length)}
            </Badge>
          ) : null}
          {!readOnly ? (
            low > 0 ? (
              <Badge tone="warning" dot>
                {R.toCheck(low)}
              </Badge>
            ) : (
              <Badge tone="success">
                <CheckCircle2 aria-hidden /> {R.allChecked}
              </Badge>
            )
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
              <XIcon aria-hidden />
              <span className="sr-only">{fr.common.close}</span>
            </Button>
          </DialogClose>
        </header>

        {isLg ? (
          <div className={cn("grid min-h-0 flex-1", viewer ? "grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] divide-x" : "grid-cols-1")}>
            {viewer}
            <div className="scroll-thin min-h-0 overflow-y-auto px-5 pt-5 pb-8">{editorPane}</div>
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "measures" | "original");
              if (v === "original") setOriginalSeen(true);
            }}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            {viewer ? (
              <div className="shrink-0 px-4 pt-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="measures">{R.tabMeasures}</TabsTrigger>
                  <TabsTrigger value="original">{files.length > 1 ? R.tabOriginalCount(files.length) : R.tabOriginal}</TabsTrigger>
                </TabsList>
              </div>
            ) : null}
            <TabsContent value="measures" className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-8">
              {editorPane}
            </TabsContent>
            {viewer ? (
              <TabsContent value="original" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
                {originalSeen ? viewer : null}
              </TabsContent>
            ) : null}
          </Tabs>
        )}

        <footer className="flex shrink-0 items-center gap-2 border-t bg-surface-subtle px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {readOnly ? (
            <>
              <span className="text-meta text-muted-foreground">{crFr.bilan.measuresCount(count)}</span>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="ml-auto">
                  {fr.common.close}
                </Button>
              </DialogClose>
            </>
          ) : (
            <>
              {low > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!isLg) setTab("measures");
                    requestAnimationFrame(() => editor.current?.focusNextLow());
                  }}
                  aria-label={R.next}
                >
                  <ArrowDownToLine aria-hidden />
                  <span className="max-sm:hidden">{R.next}</span>
                </Button>
              ) : (
                <span className="truncate text-meta text-muted-foreground max-sm:hidden">{R.autosave}</span>
              )}
              <div className="ml-auto flex min-w-0 items-center gap-2 max-sm:flex-1 max-sm:justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {R.later}
                  </Button>
                </DialogClose>
                <Button type="button" onClick={onConfirm} disabled={confirming || (files.length === 0 && count === 0)} data-testid="confirm-measures" className="max-sm:flex-1">
                  {confirming ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
                  {confirmed ? R.done : R.confirm}
                  <Shortcut keys={["mod", "enter"]} className="ml-1 max-lg:hidden" />
                </Button>
              </div>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
