import type { ReactNode } from "react";
import { StatTile, StatTiles } from "@/components/layout/stat-tile";
import { markerPath } from "@/lib/audiology/chart";
import { freqLabel } from "@/lib/audiology/chart";
import { prostheticGain, suggestDegree, type BiapClass, type PtaResult } from "@/lib/audiology/calculations";
import type { Audiometry } from "@/lib/schemas/audiometry";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import { earTokens } from "./ear-tokens";
import { formatNumber, formatSigned } from "./measure-cells";

const R = crFr.results;

/** Bandes de l'échelle BIAP (dB) ; intensité neutre croissante, jamais la couleur de marque. */
const BANDS = [
  { key: "normale", from: 0, to: 20, cls: "bg-foreground/[0.05]" },
  { key: "legere", from: 20, to: 40, cls: "bg-foreground/[0.12]" },
  { key: "moyenne", from: 40, to: 70, cls: "bg-foreground/[0.2]" },
  { key: "severe", from: 70, to: 90, cls: "bg-foreground/[0.3]" },
  { key: "profonde", from: 90, to: 120, cls: "bg-foreground/[0.42]" },
] as const;
const TICKS = [20, 40, 70, 90, 120];

const db = (v: number) => `${formatNumber(v)} dB`;

function ClassChip({ cls }: { cls: BiapClass | null }) {
  if (!cls) return null;
  return <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{R.classShort[cls.key]}</span>;
}

function EarSymbol({ ear }: { ear: "right" | "left" }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
      <path d={markerPath(ear === "right" ? "O" : "X", 6, 6, 4)} fill="none" stroke={ear === "right" ? "var(--ear-right)" : "var(--ear-left)"} strokeWidth={1.6} />
    </svg>
  );
}

function missingText(p: PtaResult) {
  return p.missing.length ? `${R.notComputable} (${R.missing(p.missing.map(freqLabel).join(", "))})` : R.notComputable;
}

/** Échelle BIAP avec la position des pertes moyennes OD (O) et OG (X). */
function BiapScale({ right, left }: { right: number | null; left: number | null }) {
  const pos = (v: number) => `${(Math.max(0, Math.min(120, v)) / 120) * 100}%`;
  return (
    <figure className="mt-4" aria-label={R.scale}>
      <p className="sr-only">{R.scaleSr(right === null ? null : db(right), left === null ? null : db(left))}</p>
      <div aria-hidden className="relative h-4">
        {right !== null ? (
          <span className="absolute top-0 -translate-x-1/2" style={{ left: pos(right) }}>
            <EarSymbol ear="right" />
          </span>
        ) : null}
        {left !== null ? (
          <span className="absolute top-0 -translate-x-1/2" style={{ left: pos(left) }}>
            <EarSymbol ear="left" />
          </span>
        ) : null}
      </div>
      <div aria-hidden className="flex h-2 overflow-hidden rounded-full">
        {BANDS.map((b) => (
          <span key={b.key} className={cn("h-full border-r border-card last:border-r-0", b.cls)} style={{ width: `${((b.to - b.from) / 120) * 100}%` }} />
        ))}
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-2xs text-muted-foreground tabular-nums">
        {TICKS.map((t) => (
          <span key={t} className={cn("absolute", t === 120 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: pos(t) }}>
            {t}
          </span>
        ))}
      </div>
      <div aria-hidden className="relative h-4 text-2xs text-muted-foreground">
        {BANDS.map((b) => (
          <span key={b.key} className="absolute -translate-x-1/2 truncate max-sm:hidden" style={{ left: pos((b.from + b.to) / 2) }}>
            {R.scaleBands[b.key]}
          </span>
        ))}
      </div>
    </figure>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Résultats calculés en code (BIAP, gain prothétique) : tuiles lisibles.
 * `full` dans la vérification du bilan ; `compact` dans la carte de synthèse.
 */
export function AudiometryResults({ value, variant = "full", className }: { value: Audiometry; variant?: "full" | "compact"; className?: string }) {
  const s = suggestDegree(value);
  const g = prostheticGain(value);

  if (variant === "compact") {
    const items: { label: ReactNode; value: string; detail?: string }[] = [
      { label: <><EarSymbol ear="right" /> {R.right}</>, value: s.right.value === null ? "—" : db(s.right.value), detail: s.right.class ? R.classShort[s.right.class.key] : undefined },
      { label: <><EarSymbol ear="left" /> {R.left}</>, value: s.left.value === null ? "—" : db(s.left.value), detail: s.left.class ? R.classShort[s.left.class.key] : undefined },
      { label: R.global, value: s.global === null ? "—" : db(s.global), detail: s.globalClass ? R.classShort[s.globalClass.key] : undefined },
      { label: R.meanGain, value: g.mean === null ? "—" : db(g.mean) },
      { label: R.scoreGain, value: g.speech.scoreGain === null ? "—" : R.points(formatSigned(g.speech.scoreGain)) },
      { label: R.srtGain, value: g.speech.srtGain === null ? "—" : db(g.speech.srtGain) },
    ];
    return (
      <dl aria-label={R.title} className={cn(earTokens, "grid min-w-0 grid-cols-2 gap-2 self-start", className)}>
        {items.map((it, i) => (
          <div key={i} className="min-w-0 rounded-lg bg-surface-subtle px-3 py-2 ring-1 ring-border/70">
            <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">{it.label}</dt>
            <dd className="text-base font-semibold tracking-tight tabular-nums">{it.value}</dd>
            {it.detail ? <dd className="truncate text-xs text-muted-foreground">{it.detail}</dd> : null}
          </div>
        ))}
      </dl>
    );
  }

  const tiles = "grid-cols-1 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3";
  return (
    <section aria-label={R.title} className={cn(earTokens, "space-y-6", className)}>
      <Group title={R.lossTitle}>
        <StatTiles className={tiles}>
          <StatTile
            label={<span className="inline-flex items-center gap-1.5"><EarSymbol ear="right" /> {R.right}</span>}
            value={s.right.value === null ? "—" : db(s.right.value)}
            detail={s.right.value === null ? missingText(s.right) : <ClassChip cls={s.right.class} />}
          />
          <StatTile
            label={<span className="inline-flex items-center gap-1.5"><EarSymbol ear="left" /> {R.left}</span>}
            value={s.left.value === null ? "—" : db(s.left.value)}
            detail={s.left.value === null ? missingText(s.left) : <ClassChip cls={s.left.class} />}
          />
          <StatTile label={R.global} value={s.global === null ? "—" : db(s.global)} detail={s.global === null ? R.notComputable : <ClassChip cls={s.globalClass} />} />
        </StatTiles>
        <BiapScale right={s.right.value} left={s.left.value} />
      </Group>
      <Group title={R.gainTitle}>
        <StatTiles className={tiles}>
          <StatTile
            label={R.meanGain}
            value={g.mean === null ? "—" : db(g.mean)}
            detail={g.mean === null ? R.notMeasured : `${g.meanFrequencies.map(freqLabel).join(", ")} Hz`}
          />
          <StatTile
            label={R.srtGain}
            value={g.speech.srtGain === null ? "—" : db(g.speech.srtGain)}
            detail={g.speech.srtUnaided !== null && g.speech.srtAided !== null ? `${db(g.speech.srtUnaided)} → ${db(g.speech.srtAided)}` : R.notMeasured}
          />
          <StatTile
            label={R.scoreGain}
            value={g.speech.scoreGain === null ? "—" : R.points(formatSigned(g.speech.scoreGain))}
            detail={g.speech.scoreUnaided !== null && g.speech.scoreAided !== null ? `${formatNumber(g.speech.scoreUnaided)} → ${formatNumber(g.speech.scoreAided)} %` : R.notMeasured}
          />
          {g.noise && g.noise.snrGain !== null ? <StatTile label={R.noiseGain} value={db(g.noise.snrGain)} detail={value.noise?.testName ?? undefined} /> : null}
          {g.noise && g.noise.scoreGain !== null ? (
            <StatTile label={R.noiseScoreGain} value={R.points(formatSigned(g.noise.scoreGain))} detail={value.noise?.testName ?? undefined} />
          ) : null}
        </StatTiles>
      </Group>
    </section>
  );
}
