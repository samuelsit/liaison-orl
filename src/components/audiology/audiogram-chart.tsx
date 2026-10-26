"use client";

import { Fragment, useId, useState } from "react";
import {
  CHART_FREQS,
  CHART_MAJOR,
  DB_MAX,
  DB_MIN,
  freqLabel,
  markerPath,
  noResponseArrow,
  polyline,
  xForFreq,
  yForDb,
  type ChartSeries,
  type Marker,
} from "@/lib/audiology/chart";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import { earColorVar, earTokens } from "./ear-tokens";
import { formatNumber, freqLong, type GainBand } from "./measure-cells";

const C = crFr.chart;

/*
 * Géométrie par taille (unités du viewBox). Rapport proche de l'audiogramme
 * clinique (1 octave ≈ 20 dB) pour « md » ; « wide » pour le champ libre en pleine largeur.
 */
const GEOMETRY = {
  sm: { w: 240, h: 196, left: 28, right: 8, top: 8, bottom: 20, font: 10, marker: 3.6, hit: 9 },
  md: { w: 360, h: 320, left: 34, right: 10, top: 10, bottom: 24, font: 11, marker: 4.5, hit: 10 },
  wide: { w: 720, h: 300, left: 34, right: 12, top: 10, bottom: 24, font: 11, marker: 4.5, hit: 10 },
} as const;

export type AudiogramSize = keyof typeof GEOMETRY;

export interface AudiogramPointRef {
  seriesKey: string;
  freq: number;
}

interface HoverState {
  x: number;
  y: number;
  text: string;
}

function pointText(s: ChartSeries, p: ChartSeries["points"][number]): string {
  const value = p.noResponse ? C.noResponse : `${formatNumber(p.db)} dB`;
  return C.point(s.label, freqLong(p.freq), value) + (p.lowConfidence ? ` · ${C.lowConfidence}` : "");
}

/**
 * Audiogramme redessiné (conventions : O rouge oreille droite, X bleu oreille gauche,
 * osseuse en pointillés, S / A en champ libre). Fond transparent, couleurs par thème.
 * Survol : valeur du point ; clic : `onPointClick` (relie le point à sa case du tableau).
 */
export function AudiogramChart({
  title,
  series,
  size = "md",
  highlight = null,
  onPointClick,
  gain,
  legend = true,
  showTitle = true,
  className,
}: {
  title: string;
  series: ChartSeries[];
  size?: AudiogramSize;
  highlight?: AudiogramPointRef | null;
  onPointClick?: (p: AudiogramPointRef) => void;
  /** Zone de gain prothétique à ombrer (champ libre). */
  gain?: GainBand[];
  legend?: boolean;
  showTitle?: boolean;
  className?: string;
}) {
  const g = GEOMETRY[size];
  const titleId = useId();
  const [hover, setHover] = useState<HoverState | null>(null);
  const x0 = g.left;
  const y0 = g.top;
  const cw = g.w - g.left - g.right;
  const ch = g.h - g.top - g.bottom;
  const grid: number[] = [];
  for (let db = DB_MIN; db <= DB_MAX; db += 10) grid.push(db);
  const description = series
    .filter((s) => s.points.length)
    .map((s) => `${s.label} : ${s.points.map((p) => `${p.freq} Hz ${p.noResponse ? C.noResponse : `${p.db} dB`}`).join(", ")}`)
    .join(". ");

  const gainPath =
    gain && gain.length > 1
      ? [
          ...gain.map((b) => `${xForFreq(b.freq, x0, cw).toFixed(2)} ${yForDb(b.aided, y0, ch).toFixed(2)}`),
          ...[...gain].reverse().map((b) => `${xForFreq(b.freq, x0, cw).toFixed(2)} ${yForDb(b.unaided, y0, ch).toFixed(2)}`),
        ]
          .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt}`)
          .join(" ") + " Z"
      : null;
  const gainLabel =
    gain && gain.length > 1
      ? (() => {
          const mid = gain[Math.floor((gain.length - 1) / 2)]!;
          return { x: xForFreq(mid.freq, x0, cw), y: yForDb((mid.aided + mid.unaided) / 2, y0, ch) };
        })()
      : null;

  const keys = series.map((s) => s.key);
  const isFreeField = keys.some((k) => k.startsWith("ff"));
  const isCombined = keys.some((k) => k.startsWith("right")) && keys.some((k) => k.startsWith("left"));

  return (
    <figure className={cn(earTokens, "min-w-0 [--chart-surface:var(--card)]", className)} aria-labelledby={showTitle ? titleId : undefined}>
      {showTitle ? (
        <figcaption id={titleId} className="mb-1.5 text-sm font-medium text-foreground">
          {title}
        </figcaption>
      ) : null}
      <div className="relative">
        <svg
          viewBox={`0 0 ${g.w} ${g.h}`}
          className="block h-auto w-full overflow-visible"
          role="img"
          aria-label={`Audiogramme, ${title}. ${description || C.empty}`}
          onMouseLeave={() => setHover(null)}
        >
          <rect x={x0} y={y0} width={cw} height={ch} fill="none" stroke="var(--border)" strokeWidth={1} />
          {grid.map((db) => (
            <g key={db}>
              <line
                x1={x0}
                x2={x0 + cw}
                y1={yForDb(db, y0, ch)}
                y2={yForDb(db, y0, ch)}
                stroke={db === 20 ? "var(--muted-foreground)" : "var(--dv-grid)"}
                strokeOpacity={db === 20 ? 0.5 : 1}
                strokeWidth={db === 20 ? 1 : 0.75}
              />
              {db % 20 === 0 && db < DB_MAX ? (
                <text x={x0 - 4} y={yForDb(db, y0, ch) + g.font * 0.35} fontSize={g.font} textAnchor="end" fill="var(--muted-foreground)" className="tabular-nums">
                  {db}
                </text>
              ) : null}
            </g>
          ))}
          {CHART_FREQS.map((f) => (
            <line
              key={f}
              x1={xForFreq(Number(f), x0, cw)}
              x2={xForFreq(Number(f), x0, cw)}
              y1={y0}
              y2={y0 + ch}
              stroke="var(--dv-grid)"
              strokeWidth={CHART_MAJOR.includes(f) ? 0.75 : 0.6}
              strokeDasharray={CHART_MAJOR.includes(f) ? undefined : "2 3"}
            />
          ))}
          {CHART_MAJOR.map((f) => (
            <text key={f} x={xForFreq(Number(f), x0, cw)} y={y0 + ch + g.font + 4} fontSize={g.font} textAnchor="middle" fill="var(--muted-foreground)" className="tabular-nums">
              {freqLabel(f)}
            </text>
          ))}
          {gainPath ? (
            <g aria-hidden>
              <path d={gainPath} fill="var(--ear-aided)" fillOpacity={0.12} stroke="none" />
              {gainLabel ? (
                <text x={gainLabel.x} y={gainLabel.y + g.font * 0.35} fontSize={g.font} textAnchor="middle" fill="var(--ear-aided)" fontWeight={600}>
                  {C.gain}
                </text>
              ) : null}
            </g>
          ) : null}
          {series.map((s) => {
            const color = earColorVar(s.key);
            return (
              <g key={s.key}>
                <path d={polyline(s, x0, y0, cw, ch)} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
                {s.points.map((p) => {
                  const px = xForFreq(p.freq, x0, cw);
                  const py = yForDb(p.db, y0, ch);
                  const active = highlight?.seriesKey === s.key && highlight.freq === p.freq;
                  return (
                    <Fragment key={p.freq}>
                      {p.lowConfidence ? <circle cx={px} cy={py} r={g.marker * 2} fill="var(--warning-border)" fillOpacity={0.4} /> : null}
                      {active ? <circle cx={px} cy={py} r={g.marker * 2.1} fill="none" stroke="var(--ring)" strokeWidth={2} /> : null}
                      <path
                        d={markerPath(s.marker, px, py, g.marker)}
                        fill={s.marker === "O" ? "var(--chart-surface)" : "none"}
                        stroke={color}
                        strokeWidth={1.7}
                        strokeLinecap="round"
                      />
                      {p.noResponse ? <path d={noResponseArrow(px, py, g.marker)} fill="none" stroke={color} strokeWidth={1.3} /> : null}
                      <circle
                        cx={px}
                        cy={py}
                        r={g.hit}
                        fill="transparent"
                        className={onPointClick ? "cursor-pointer" : undefined}
                        onMouseEnter={() => setHover({ x: (px / g.w) * 100, y: (py / g.h) * 100, text: pointText(s, p) })}
                        onClick={onPointClick ? () => onPointClick({ seriesKey: s.key, freq: p.freq }) : undefined}
                      />
                    </Fragment>
                  );
                })}
              </g>
            );
          })}
        </svg>
        {hover ? (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md"
            style={{ left: `${hover.x}%`, top: `${hover.y}%` }}
          >
            {hover.text}
          </div>
        ) : null}
      </div>
      {legend ? <AudiogramLegend kind={isFreeField ? "freeField" : isCombined ? "combined" : keys[0]?.startsWith("left") ? "left" : "right"} /> : null}
    </figure>
  );
}

function Symbol({ marker, color, dashed }: { marker: Marker; color: string; dashed?: boolean }) {
  return (
    <svg viewBox="0 0 28 12" className="h-3 w-7 shrink-0" aria-hidden>
      <line x1={1} x2={27} y1={6} y2={6} stroke={color} strokeWidth={1.4} strokeDasharray={dashed ? "4 3" : undefined} />
      <path d={markerPath(marker, 14, 6, 4)} fill={marker === "O" ? "var(--chart-surface)" : "none"} stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

/** Légende sous l'audiogramme (symboles et traits), en texte secondaire. */
export function AudiogramLegend({ kind }: { kind: "right" | "left" | "freeField" | "combined" }) {
  const items: { marker: Marker; color: string; dashed?: boolean; label: string }[] =
    kind === "freeField"
      ? [
          { marker: "S", color: "var(--ear-unaided)", dashed: true, label: C.unaided },
          { marker: "A", color: "var(--ear-aided)", label: C.aided },
        ]
      : kind === "combined"
        ? [
            { marker: "O", color: "var(--ear-right)", label: C.rightShort },
            { marker: "X", color: "var(--ear-left)", label: C.leftShort },
            { marker: "<", color: "var(--muted-foreground)", dashed: true, label: C.bone },
          ]
        : [
            { marker: kind === "right" ? "O" : "X", color: kind === "right" ? "var(--ear-right)" : "var(--ear-left)", label: C.air },
            { marker: kind === "right" ? "<" : ">", color: kind === "right" ? "var(--ear-right)" : "var(--ear-left)", dashed: true, label: C.bone },
          ];
  return (
    <ul aria-label={C.legend} className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <Symbol marker={it.marker} color={it.color} dashed={it.dashed} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
