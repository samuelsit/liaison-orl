"use client";

import { useCallback, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { earSeries, freeFieldSeries } from "@/lib/audiology/chart";
import type { Audiometry, FreqKey } from "@/lib/schemas/audiometry";
import { useIsMobile } from "@/hooks/use-mobile";
import { fr } from "@/lib/i18n/fr";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import { AudiogramChart, type AudiogramPointRef } from "./audiogram-chart";
import { AudiometryResults } from "./audiometry-results";
import { NoiseTestFields, SpeechGrid, ThresholdGrid } from "./audiometry-tables";
import { earTokens } from "./ear-tokens";
import {
  gainBands,
  hasIntermediateValues,
  INTERMEDIATE_FREQS,
  listLowConfidence,
  pathToSeriesKey,
  refId,
  seriesKeyToPath,
  visibleFrequencies,
  type CurvePath,
} from "./measure-cells";
import { MobileAudiometryEntry, segmentOf, type MobileSegment } from "./mobile-audiometry-entry";

const G = crFr.grid;

export interface AudiometryEditorApi {
  /** Place le focus sur la prochaine valeur à vérifier (confiance faible) ; faux s'il n'y en a plus. */
  focusNextLow: () => boolean;
}

/**
 * Vérification et correction des mesures extraites : audiogrammes (survol, clic →
 * case), tableau de seuils façon tableur, vocale, bruit, résultats calculés en code.
 * Sous 768 px : saisie oreille par oreille (MobileAudiometryEntry).
 */
export function AudiometryEditor({
  value,
  onChange,
  readOnly,
  ref,
  className,
}: {
  value: Audiometry;
  onChange: (a: Audiometry) => void;
  readOnly?: boolean;
  ref?: Ref<AudiometryEditorApi>;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [showIntermediate, setShowIntermediate] = useState(() => hasIntermediateValues(value));
  const [segment, setSegment] = useState<MobileSegment>("right");
  const [activeCell, setActiveCell] = useState<{ path: CurvePath; freq: FreqKey } | null>(null);
  const freqs = visibleFrequencies(showIntermediate);
  const confidenceIds = { low: `${id}-low`, medium: `${id}-medium` };
  const highlight: AudiogramPointRef | null = activeCell ? { seriesKey: pathToSeriesKey(activeCell.path), freq: Number(activeCell.freq) } : null;

  const focusRef = useCallback((key: string) => {
    // Après un éventuel changement d'affichage (segment, fréquences intermédiaires).
    requestAnimationFrame(() => {
      const el = root.current?.querySelector<HTMLInputElement>(`input[data-ref="${key}"]`);
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusNextLow: () => {
        const low = listLowConfidence(value);
        if (!low.length) return false;
        const current = (document.activeElement as HTMLElement | null)?.dataset?.ref;
        const index = current ? low.findIndex((r) => refId(r) === current) : -1;
        const target = low[(index + 1) % low.length]!;
        if (target.kind === "curve" && INTERMEDIATE_FREQS.includes(target.freq)) setShowIntermediate(true);
        if (isMobile) setSegment(segmentOf(target));
        focusRef(refId(target));
        return true;
      },
    }),
    [focusRef, isMobile, value],
  );

  function onPointClick(p: AudiogramPointRef) {
    const path = seriesKeyToPath(p.seriesKey);
    if (!path) return;
    const freq = String(p.freq) as FreqKey;
    if (INTERMEDIATE_FREQS.includes(freq)) setShowIntermediate(true);
    focusRef(refId({ kind: "curve", path, freq }));
  }

  const confidenceTexts = (
    <span hidden>
      <span id={confidenceIds.low}>{fr.ai.lowConfidence}</span>
      <span id={confidenceIds.medium}>{fr.ai.mediumConfidence}</span>
    </span>
  );

  const notes = value.notes ? (
    <p className="flex items-start gap-2 rounded-lg border border-info-border/70 bg-info px-3 py-2.5 text-sm text-info-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-medium">{G.notes} : </span>
        {value.notes}
      </span>
    </p>
  ) : null;

  if (isMobile) {
    return (
      <div ref={root} className={cn(earTokens, "space-y-6", className)}>
        {confidenceTexts}
        {notes}
        <MobileAudiometryEntry
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          freqs={freqs}
          showIntermediate={showIntermediate}
          onShowIntermediateChange={setShowIntermediate}
          segment={segment}
          onSegmentChange={setSegment}
          confidenceIds={confidenceIds}
          idPrefix={id}
        />
        <AudiometryResults value={value} variant="compact" />
      </div>
    );
  }

  return (
    <div ref={root} className={cn(earTokens, "space-y-8", className)}>
      {confidenceTexts}
      <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
        <AudiogramChart title={crFr.chart.titles.right} series={earSeries(value, "right")} highlight={highlight} onPointClick={onPointClick} className="[--chart-surface:var(--popover)]" />
        <AudiogramChart title={crFr.chart.titles.left} series={earSeries(value, "left")} highlight={highlight} onPointClick={onPointClick} className="[--chart-surface:var(--popover)]" />
        <AudiogramChart
          size="wide"
          title={crFr.chart.titles.freeField}
          series={freeFieldSeries(value)}
          gain={gainBands(value.freeField.unaided, value.freeField.aided)}
          highlight={highlight}
          onPointClick={onPointClick}
          className="[--chart-surface:var(--popover)] sm:col-span-2"
        />
      </div>

      {notes}

      <section aria-labelledby={`${id}-thresholds`} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 id={`${id}-thresholds`} className="text-sm font-semibold tracking-tight">
            {G.title}
          </h3>
          <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-meta text-muted-foreground pointer-coarse:min-h-11">
            <Switch size="sm" checked={showIntermediate} onCheckedChange={setShowIntermediate} />
            {G.intermediate}
          </label>
        </div>
        <ThresholdGrid value={value} onChange={onChange} readOnly={readOnly} freqs={freqs} confidenceIds={confidenceIds} onCellFocus={setActiveCell} />
        {!readOnly ? <p className="text-meta text-muted-foreground">{G.help}</p> : null}
      </section>

      <section aria-labelledby={`${id}-speech`} className="space-y-2">
        <h3 id={`${id}-speech`} className="text-sm font-semibold tracking-tight">
          {G.speechTitle}
        </h3>
        <SpeechGrid value={value} onChange={onChange} readOnly={readOnly} confidenceIds={confidenceIds} />
      </section>

      <NoiseTestFields value={value} onChange={onChange} readOnly={readOnly} confidenceIds={confidenceIds} idPrefix={id} />

      <AudiometryResults value={value} />
    </div>
  );
}
