"use client";

import { useState } from "react";
import { Check, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { earSeries, freeFieldSeries, freqLabel } from "@/lib/audiology/chart";
import type { Audiometry, FreqKey } from "@/lib/schemas/audiometry";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import { AudiogramChart } from "./audiogram-chart";
import { MarkerGlyph, NoiseTestFields, type ConfidenceIds } from "./audiometry-tables";
import {
  cellText,
  freqLong,
  gainBands,
  getMeasure,
  GRID_ROWS,
  markChecked,
  refId,
  setMeasure,
  SPEECH_KEYS,
  SPEECH_TARGETS,
  type EarGroup,
  type MeasureRef,
} from "./measure-cells";
import { MeasureInput } from "./measure-input";

const G = crFr.grid;
const M = crFr.mobile;

export type MobileSegment = EarGroup | "speech";
export const MOBILE_SEGMENTS: MobileSegment[] = ["right", "left", "freeField", "speech"];

/** Segment où se trouve une mesure (pour « valeur suivante à vérifier »). */
export function segmentOf(ref: MeasureRef): MobileSegment {
  if (ref.kind === "curve") return ref.path.split(".")[0] as EarGroup;
  return "speech";
}

function CellActions({
  value,
  onChange,
  activeRef,
}: {
  value: Audiometry;
  onChange: (a: Audiometry) => void;
  activeRef: MeasureRef;
}) {
  const m = getMeasure(value, activeRef);
  // Le focus reste dans la case : les boutons ne le prennent pas au pointeur.
  const keep = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div role="group" aria-label={M.cellActions} className="col-span-full flex flex-wrap gap-2 pb-1">
      <Button type="button" variant="outline" size="sm" onPointerDown={keep} onClick={() => onChange(setMeasure(value, activeRef, { value: null, confidence: "high", noResponse: true }))}>
        {G.nr}
      </Button>
      <Button type="button" variant="ghost" size="sm" onPointerDown={keep} onClick={() => onChange(setMeasure(value, activeRef, null))}>
        <Eraser aria-hidden /> {G.clear}
      </Button>
      {m?.confidence === "low" ? (
        <Button type="button" variant="ghost" size="sm" onPointerDown={keep} onClick={() => onChange(markChecked(value, activeRef))}>
          <Check aria-hidden /> {G.markChecked}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Saisie des mesures au téléphone : une oreille à la fois (OD, OG, champ libre,
 * vocale), clavier numérique, actions « NR / Effacer / Valeur correcte » sous la case active.
 */
export function MobileAudiometryEntry({
  value,
  onChange,
  readOnly,
  freqs,
  showIntermediate,
  onShowIntermediateChange,
  segment,
  onSegmentChange,
  confidenceIds,
  idPrefix,
}: {
  value: Audiometry;
  onChange: (a: Audiometry) => void;
  readOnly?: boolean;
  freqs: FreqKey[];
  showIntermediate: boolean;
  onShowIntermediateChange: (v: boolean) => void;
  segment: MobileSegment;
  onSegmentChange: (s: MobileSegment) => void;
  confidenceIds: ConfidenceIds;
  idPrefix: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const rows = segment === "speech" ? [] : GRID_ROWS.filter((r) => r.ear === segment);
  const kindLabels = rows.map((r) => G.kinds[r.kind]);

  const input = (ref: MeasureRef, label: string, max = 140) =>
    readOnly ? (
      <span className={cn("flex h-11 items-center justify-center rounded-lg bg-surface-subtle text-base tabular-nums", !getMeasure(value, ref) && "text-muted-foreground")}>
        {cellText(getMeasure(value, ref)) || "—"}
      </span>
    ) : (
      <MeasureInput
        variant="mobile"
        m={getMeasure(value, ref)}
        label={label}
        max={max}
        inputMode="numeric"
        enterKeyHint="next"
        lowConfidenceId={confidenceIds.low}
        mediumConfidenceId={confidenceIds.medium}
        data-ref={refId(ref)}
        onFocus={() => setActive(refId(ref))}
        onBlur={() => setActive((a) => (a === refId(ref) ? null : a))}
        onChange={(m) => onChange(setMeasure(value, ref, m))}
        onMarkChecked={() => onChange(markChecked(value, ref))}
      />
    );

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 bg-popover/95 px-4 py-2 backdrop-blur-sm">
        <SegmentedControl<MobileSegment> aria-label={M.sections} value={segment} onValueChange={onSegmentChange} fullWidth>
          {MOBILE_SEGMENTS.map((s) => (
            <SegmentedControlItem key={s} value={s} className="px-1.5">
              {M.tabs[s]}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>

      {segment !== "speech" ? (
        <>
          <AudiogramChart
            size="sm"
            title={segment === "freeField" ? crFr.chart.titles.freeField : crFr.chart.titles[segment]}
            series={segment === "freeField" ? freeFieldSeries(value) : earSeries(value, segment)}
            gain={segment === "freeField" ? gainBands(value.freeField.unaided, value.freeField.aided) : undefined}
            className="[--chart-surface:var(--popover)]"
          />
          <div role="group" aria-label={G.earNames[segment]} className="grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
            <span className="text-xs font-medium text-muted-foreground">{G.freq}</span>
            {rows.map((r, i) => (
              <span key={r.path} className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MarkerGlyph marker={r.marker} colorKey={r.path.replace(".", "-").replace("freeField-", "ff-")} />
                {kindLabels[i]}
              </span>
            ))}
            {freqs.map((f) => {
              const refs = rows.map((r) => ({ kind: "curve", path: r.path, freq: f }) as const);
              const activeRef = refs.find((r) => refId(r) === active);
              return (
                <div key={f} className="contents">
                  <span className="text-sm font-medium tabular-nums">{freqLong(f)}</span>
                  {refs.map((ref, i) => (
                    <div key={ref.path}>{input(ref, `${rows[i]!.label} ${freqLabel(f)} Hz`)}</div>
                  ))}
                  {activeRef && !readOnly ? <CellActions value={value} onChange={onChange} activeRef={activeRef} /> : null}
                </div>
              );
            })}
          </div>
          <label className="flex min-h-11 items-center justify-between gap-4 text-sm">
            {G.intermediate}
            <Switch checked={showIntermediate} onCheckedChange={onShowIntermediateChange} />
          </label>
        </>
      ) : (
        <>
          {SPEECH_TARGETS.map((t) => {
            const refs = SPEECH_KEYS.map((k) => ({ kind: "speech", target: t, key: k }) as const);
            const activeRef = refs.find((r) => refId(r) === active);
            return (
              <fieldset key={t} className="rounded-xl border bg-card p-3">
                <legend className="px-1 text-sm font-medium">{G.speechRows[t]}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {refs.map((ref) => (
                    <div key={ref.key} className="min-w-0 space-y-1">
                      <span aria-hidden className="block truncate text-xs text-muted-foreground">
                        {G.speechCols[ref.key].short}
                      </span>
                      {input(ref, `${G.speechRows[t]} — ${G.speechCols[ref.key].long}`, ref.key === "maxScore" ? 100 : 140)}
                    </div>
                  ))}
                  {activeRef && !readOnly ? <CellActions value={value} onChange={onChange} activeRef={activeRef} /> : null}
                </div>
              </fieldset>
            );
          })}
          <NoiseTestFields value={value} onChange={onChange} readOnly={readOnly} confidenceIds={confidenceIds} idPrefix={idPrefix} />
        </>
      )}
    </div>
  );
}
