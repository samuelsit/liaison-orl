"use client";

import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { freqLabel, markerPath, type Marker } from "@/lib/audiology/chart";
import type { Audiometry, FreqKey } from "@/lib/schemas/audiometry";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import { EAR_TEXT, earColorVar } from "./ear-tokens";
import {
  applyRowPaste,
  cellText,
  getCurve,
  getSpeech,
  GRID_ROWS,
  markChecked,
  NOISE_KEYS,
  refId,
  setCurveMeasure,
  setNoiseMeasure,
  setNoiseName,
  setSpeechMeasure,
  SPEECH_KEYS,
  SPEECH_TARGETS,
  freqLong,
  type CurvePath,
  type EarGroup,
} from "./measure-cells";
import { MeasureInput } from "./measure-input";
import { useGridNavigation } from "./use-grid-navigation";

const G = crFr.grid;

export interface ConfidenceIds {
  low: string;
  medium: string;
}

export function MarkerGlyph({ marker, colorKey, className }: { marker: Marker; colorKey: string; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={cn("size-3 shrink-0", className)} aria-hidden>
      <path d={markerPath(marker, 6, 6, 4)} fill="none" stroke={earColorVar(colorKey)} strokeWidth={1.6} />
    </svg>
  );
}

const EAR_GROUPS: EarGroup[] = ["right", "left", "freeField"];

/**
 * Tableau des seuils tonals, façon tableur : largeur fixe (toutes les fréquences
 * visibles sans défilement), quadrillage léger, confiance visible et annoncée.
 */
export function ThresholdGrid({
  value,
  onChange,
  readOnly,
  freqs,
  confidenceIds,
  onCellFocus,
}: {
  value: Audiometry;
  onChange: (a: Audiometry) => void;
  readOnly?: boolean;
  freqs: FreqKey[];
  confidenceIds: ConfidenceIds;
  onCellFocus?: (cell: { path: CurvePath; freq: FreqKey } | null) => void;
}) {
  const onKeyDown = useGridNavigation(GRID_ROWS.length, freqs.length);

  return (
    <div
      role="region"
      aria-label={G.region}
      tabIndex={readOnly ? 0 : undefined}
      onKeyDown={readOnly ? undefined : onKeyDown}
      className="scroll-thin overflow-x-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table className="w-full min-w-[33rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">{G.caption}</caption>
        <colgroup>
          <col className="w-11" />
          <col className="w-[5.75rem]" />
          {freqs.map((f) => (
            <col key={f} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-surface-subtle">
            <th scope="col" colSpan={2} className="h-9 px-3 text-left text-xs font-medium text-muted-foreground">
              {G.corner}
            </th>
            {freqs.map((f) => (
              <th key={f} scope="col" className="h-9 border-l border-border/60 px-0.5 text-center text-xs font-medium text-muted-foreground tabular-nums">
                <span aria-hidden>{freqLabel(f)}</span>
                <span className="sr-only">{freqLong(f)}</span>
              </th>
            ))}
          </tr>
        </thead>
        {EAR_GROUPS.map((ear) => {
          const rows = GRID_ROWS.filter((r) => r.ear === ear);
          return (
            <tbody key={ear} className="border-t-2 border-border">
              {rows.map((row, i) => {
                const rowIndex = GRID_ROWS.indexOf(row);
                const c = getCurve(value, row.path);
                return (
                  <tr key={row.path} className={cn(i > 0 && "border-t border-border/60")}>
                    {i === 0 ? (
                      <th scope="rowgroup" rowSpan={rows.length} className="border-r border-border/60 text-center align-middle">
                        <span aria-hidden className={cn("inline-flex h-6 min-w-8 items-center justify-center rounded-full px-1.5 text-xs font-semibold ring-1 ring-current/35", EAR_TEXT[ear])}>
                          {G.ears[ear]}
                        </span>
                        <span className="sr-only">{G.earNames[ear]}</span>
                      </th>
                    ) : null}
                    <th scope="row" className="border-r border-border/60 px-2 text-left text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MarkerGlyph marker={row.marker} colorKey={row.path.replace(".", "-").replace("freeField-", "ff-")} />
                        {G.kinds[row.kind]}
                      </span>
                    </th>
                    {freqs.map((f, col) => (
                      <td key={f} className="h-10 border-l border-border/60 p-0 text-center">
                        {readOnly ? (
                          <span
                            className={cn(
                              "flex h-10 items-center justify-center tabular-nums",
                              !c[f] && "text-muted-foreground",
                            )}
                          >
                            {cellText(c[f]) || "—"}
                          </span>
                        ) : (
                          <MeasureInput
                            variant="cell"
                            m={c[f]}
                            label={`${row.label} ${freqLabel(f)} Hz`}
                            lowConfidenceId={confidenceIds.low}
                            mediumConfidenceId={confidenceIds.medium}
                            data-grid-row={rowIndex}
                            data-grid-col={col}
                            data-cell={`${row.path}:${f}`}
                            data-ref={refId({ kind: "curve", path: row.path, freq: f })}
                            onFocus={() => onCellFocus?.({ path: row.path, freq: f })}
                            onBlur={() => onCellFocus?.(null)}
                            onChange={(m) => onChange(setCurveMeasure(value, row.path, f, m))}
                            onMarkChecked={() => onChange(markChecked(value, { kind: "curve", path: row.path, freq: f }))}
                            onPasteValues={(values) => {
                              const prev = value;
                              const { next, count } = applyRowPaste(value, row.path, freqs, f, values);
                              if (!count) return false;
                              onChange(next);
                              toast.success(G.pasted(count), { action: { label: G.undo, onClick: () => onChange(prev) } });
                              return true;
                            }}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

/** Audiométrie vocale : même grille, en-têtes courts (libellé complet pour les lecteurs d'écran). */
export function SpeechGrid({
  value,
  onChange,
  readOnly,
  confidenceIds,
}: {
  value: Audiometry;
  onChange: (a: Audiometry) => void;
  readOnly?: boolean;
  confidenceIds: ConfidenceIds;
}) {
  const onKeyDown = useGridNavigation(SPEECH_TARGETS.length, SPEECH_KEYS.length);
  return (
    <div
      role="region"
      aria-label={G.speechRegion}
      tabIndex={readOnly ? 0 : undefined}
      onKeyDown={readOnly ? undefined : onKeyDown}
      className="scroll-thin overflow-x-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table className="w-full min-w-[26rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">{G.speechTitle}</caption>
        <colgroup>
          <col className="w-[9.5rem]" />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="bg-surface-subtle">
            <td className="h-9" />
            {SPEECH_KEYS.map((k) => (
              <th key={k} scope="col" title={G.speechCols[k].long} className="h-9 border-l border-border/60 px-1 text-center text-xs font-medium text-muted-foreground">
                <span aria-hidden>{G.speechCols[k].short}</span>
                <span className="sr-only">{G.speechCols[k].long}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SPEECH_TARGETS.map((t, rowIndex) => {
            const sp = getSpeech(value, t);
            return (
              <tr key={t} className={cn("border-t border-border/60", t === "speechUnaided" && "border-t-2 border-border")}>
                <th scope="row" className="px-3 text-left text-xs font-medium text-muted-foreground">
                  {G.speechRows[t]}
                </th>
                {SPEECH_KEYS.map((k, col) => (
                  <td key={k} className="h-10 border-l border-border/60 p-0 text-center">
                    {readOnly ? (
                      <span className={cn("flex h-10 items-center justify-center tabular-nums", !sp[k] && "text-muted-foreground")}>{cellText(sp[k]) || "—"}</span>
                    ) : (
                      <MeasureInput
                        variant="cell"
                        m={sp[k]}
                        max={k === "maxScore" ? 100 : 140}
                        label={`${G.speechRows[t]} — ${G.speechCols[k].long}`}
                        lowConfidenceId={confidenceIds.low}
                        mediumConfidenceId={confidenceIds.medium}
                        data-grid-row={rowIndex}
                        data-grid-col={col}
                        data-ref={refId({ kind: "speech", target: t, key: k })}
                        onChange={(m) => onChange(setSpeechMeasure(value, t, k, m))}
                        onMarkChecked={() => onChange(markChecked(value, { kind: "speech", target: t, key: k }))}
                      />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Test dans le bruit (facultatif), replié s'il est vide. */
export function NoiseTestFields({
  value,
  onChange,
  readOnly,
  confidenceIds,
  idPrefix,
}: {
  value: Audiometry;
  onChange: (a: Audiometry) => void;
  readOnly?: boolean;
  confidenceIds: ConfidenceIds;
  idPrefix: string;
}) {
  const n = value.noise;
  const hasData = Boolean(n && (n.testName || NOISE_KEYS.some((k) => n[k])));
  if (readOnly && !hasData) return null;
  return (
    <Collapsible defaultOpen={hasData} className="rounded-xl border bg-card">
      <CollapsibleTrigger className="group/noise flex min-h-11 w-full items-center gap-2 rounded-xl px-4 text-left text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40">
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]/noise:rotate-180" aria-hidden />
        {G.noiseTitle}
        <span className="text-meta font-normal text-muted-foreground">{n?.testName ? `· ${n.testName}` : `· ${G.noiseOptional}`}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t px-4 pt-4 pb-4">
        <div className="max-w-xs space-y-1.5">
          <label htmlFor={`${idPrefix}-noise-name`} className="text-sm font-medium">
            {G.noiseName}
          </label>
          {readOnly ? (
            <p id={`${idPrefix}-noise-name`} className="text-sm">{n?.testName || "—"}</p>
          ) : (
            <Input
              id={`${idPrefix}-noise-name`}
              value={n?.testName ?? ""}
              maxLength={80}
              placeholder={G.noiseNamePlaceholder}
              onChange={(e) => onChange(setNoiseName(value, e.target.value))}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
          {NOISE_KEYS.map((k) => (
            <Fragment key={k}>
              <div className="min-w-0 space-y-1.5">
                <span id={`${idPrefix}-noise-${k}`} className="block text-xs font-medium text-muted-foreground">
                  {G.noiseFields[k]}
                </span>
                {readOnly ? (
                  <p className="text-sm tabular-nums">
                    {cellText(n?.[k]) || "—"}
                  </p>
                ) : (
                  <MeasureInput
                    m={n?.[k] ?? null}
                    max={k.endsWith("Score") ? 100 : 140}
                    label={G.noiseFields[k]}
                    lowConfidenceId={confidenceIds.low}
                    mediumConfidenceId={confidenceIds.medium}
                    data-ref={refId({ kind: "noise", key: k })}
                    onChange={(m) => onChange(setNoiseMeasure(value, k, m))}
                    onMarkChecked={() => onChange(markChecked(value, { kind: "noise", key: k }))}
                  />
                )}
              </div>
            </Fragment>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
