import "server-only";
import { Fragment } from "react";
import { Path, Svg, Text, View } from "@react-pdf/renderer";
import { pdfFr } from "@/lib/i18n/pdf";
import {
  CHART_FREQS,
  CHART_MAJOR,
  DB_MAX,
  DB_MIN,
  earSeries,
  freeFieldSeries,
  markerPath,
  noResponseArrow,
  xForFreq,
  yForDb,
  type ChartSeries,
} from "@/lib/audiology/chart";
import type { GainPoint, GainResult } from "@/lib/audiology/calculations";
import type { Audiometry, FreqKey } from "@/lib/schemas/audiometry";
import { CONTENT_WIDTH, TYPE, WEIGHT, mm } from "../tokens";
import { TABULAR, labelStyle, text, type DocTheme } from "./theme";

const L = pdfFr.compteRendu.audiogram.legend;

/** Fréquence affichée en toutes lettres (125 … 8000), comme sur un audiogramme clinique. */
const hz = (f: FreqKey) => String(Number(f));

interface PlotSeries extends ChartSeries {
  /** Points reliés par une ligne (les seuils osseux ne le sont pas). */
  joined: boolean;
}

/** Courbes de l'audiogramme : CA reliées, CO en symboles seuls, champ libre sans / avec appareils. */
export function audiogramSeries(a: Audiometry): PlotSeries[] {
  const [rightAir, rightBone, rightAided] = earSeries(a, "right");
  const [leftAir, leftBone, leftAided] = earSeries(a, "left");
  const [unaided, aided] = freeFieldSeries(a);
  return [
    { ...rightAir!, label: L.rightAir, joined: true },
    { ...leftAir!, label: L.leftAir, joined: true },
    { ...rightBone!, label: L.rightBone, joined: false },
    { ...leftBone!, label: L.leftBone, joined: false },
    { ...rightAided!, label: L.rightAided, joined: true },
    { ...leftAided!, label: L.leftAided, joined: true },
    { ...unaided!, label: L.unaided, joined: true },
    { ...aided!, label: L.aided, joined: true },
  ].filter((s) => s.points.length > 0);
}

const MARKER_R = 3;

function linePath(s: PlotSeries, x0: number, y0: number, w: number, h: number): string {
  return s.points
    .filter((p) => !p.noResponse)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xForFreq(p.freq, x0, w).toFixed(2)} ${yForDb(p.db, y0, h).toFixed(2)}`)
    .join(" ");
}

function SeriesMarks({ s, x0, y0, w, h }: { s: PlotSeries; x0: number; y0: number; w: number; h: number }) {
  return (
    <>
      {s.joined ? (
        <Path
          d={linePath(s, x0, y0, w, h)}
          fill="none"
          stroke={s.color}
          strokeWidth={0.9}
          strokeDasharray={s.dashed ? "2.5,1.8" : undefined}
        />
      ) : null}
      {s.points.map((p) => {
        const px = xForFreq(p.freq, x0, w);
        const py = yForDb(p.db, y0, h);
        return (
          <Fragment key={`${s.key}-${p.freq}`}>
            <Path
              d={markerPath(s.marker, px, py, MARKER_R)}
              fill={s.marker === "O" ? "#FFFFFF" : "none"}
              stroke={s.color}
              strokeWidth={0.9}
            />
            {p.noResponse ? (
              <Path d={noResponseArrow(px, py, MARKER_R)} fill="none" stroke={s.color} strokeWidth={0.8} />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

/** Symbole de légende : court segment + marqueur. */
function LegendSwatch({ s }: { s: PlotSeries }) {
  const w = mm(7);
  const h = mm(4);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {s.joined ? (
        <Path
          d={`M 1 ${h / 2} L ${w - 1} ${h / 2}`}
          stroke={s.color}
          strokeWidth={0.9}
          strokeDasharray={s.dashed ? "2.5,1.8" : undefined}
        />
      ) : null}
      <Path
        d={markerPath(s.marker, w / 2, h / 2, MARKER_R)}
        fill={s.marker === "O" ? "#FFFFFF" : "none"}
        stroke={s.color}
        strokeWidth={0.9}
      />
    </Svg>
  );
}

const CHART = { w: 110, h: 70, left: 10, right: 3, top: 4, bottom: 7 } as const;

export interface AudiogramFact {
  label: string;
  value: string;
  strong?: boolean;
}

/**
 * Audiogramme redessiné en vectoriel (≈ 110 × 70 mm), conventions standard :
 * O rouge oreille droite, X bleu oreille gauche. À droite : synthèse (degré,
 * oreilles, perte moyenne) puis légende.
 */
export function Audiogram({
  theme,
  audiometry,
  facts = [],
}: {
  theme: DocTheme;
  audiometry: Audiometry;
  facts?: AudiogramFact[];
}) {
  const series = audiogramSeries(audiometry);
  if (series.length === 0) return null;
  const W = mm(CHART.w);
  const H = mm(CHART.h);
  const x0 = mm(CHART.left);
  const y0 = mm(CHART.top);
  const pw = W - x0 - mm(CHART.right);
  const ph = H - y0 - mm(CHART.bottom);
  const dbLines: number[] = [];
  for (let db = DB_MIN; db <= DB_MAX; db += 10) dbLines.push(db);
  const labelText = {
    ...text(theme, TYPE.footer, WEIGHT.regular, theme.t.label, 1),
    fontFeatureSettings: [...TABULAR],
  };
  const legendWidth = CONTENT_WIDTH - CHART.w - 6;
  const hasNoResponse = series.some((s) => s.points.some((p) => p.noResponse));

  return (
    <View wrap={false} style={{ flexDirection: "row", marginTop: mm(2) }}>
      <View style={{ width: W, height: H, position: "relative" }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {dbLines.map((db) => (
            <Path
              key={db}
              d={`M ${x0} ${yForDb(db, y0, ph)} L ${x0 + pw} ${yForDb(db, y0, ph)}`}
              stroke={theme.t.grid}
              strokeWidth={db === 0 ? 0.6 : 0.3}
            />
          ))}
          {CHART_FREQS.map((f) => {
            const x = xForFreq(Number(f), x0, pw);
            const major = CHART_MAJOR.includes(f);
            return (
              <Path
                key={f}
                d={`M ${x} ${y0} L ${x} ${y0 + ph}`}
                stroke={theme.t.grid}
                strokeWidth={major ? 0.35 : 0.25}
                strokeDasharray={major ? undefined : "1.2,1.2"}
              />
            );
          })}
          <Path
            d={`M ${x0} ${y0} L ${x0 + pw} ${y0} L ${x0 + pw} ${y0 + ph} L ${x0} ${y0 + ph} Z`}
            fill="none"
            stroke={theme.t.label}
            strokeWidth={0.5}
          />
          {series.map((s) => (
            <SeriesMarks key={s.key} s={s} x0={x0} y0={y0} w={pw} h={ph} />
          ))}
        </Svg>
        {dbLines
          .filter((db) => db % 20 === 0)
          .map((db) => (
            <Text
              key={db}
              style={{
                ...labelText,
                position: "absolute",
                left: 0,
                width: x0 - mm(1.5),
                top: yForDb(db, y0, ph) - TYPE.footer / 2,
                textAlign: "right",
              }}
            >
              {String(db)}
            </Text>
          ))}
        {CHART_MAJOR.map((f) => (
          <Text
            key={f}
            style={{
              ...labelText,
              position: "absolute",
              left: xForFreq(Number(f), x0, pw) - mm(5),
              width: mm(10),
              top: y0 + ph + mm(1.5),
              textAlign: "center",
            }}
          >
            {hz(f)}
          </Text>
        ))}
        <Text style={{ ...labelText, position: "absolute", left: 0, top: 0, width: x0 + mm(10) }}>
          {pdfFr.compteRendu.audiogram.axisDb}
        </Text>
        <Text
          style={{
            ...labelText,
            position: "absolute",
            left: x0 + pw - mm(10),
            width: mm(10),
            top: y0 + ph + mm(4.5),
            textAlign: "right",
          }}
        >
          {pdfFr.compteRendu.audiogram.axisHz}
        </Text>
      </View>
      <View style={{ width: mm(legendWidth), marginLeft: mm(6), paddingTop: y0 }}>
        {facts.map((f) => (
          <View key={f.label} style={{ marginBottom: mm(3) }}>
            <Text style={labelStyle(theme)}>{f.label}</Text>
            <Text
              style={{
                ...text(theme, TYPE.body, f.strong ? WEIGHT.semibold : WEIGHT.regular, theme.t.ink, 1.3),
                fontFeatureSettings: [...TABULAR],
              }}
            >
              {f.value}
            </Text>
          </View>
        ))}
        {facts.length ? <View style={{ height: 0.5, backgroundColor: theme.t.hairline, marginBottom: mm(2) }} /> : null}
        {series.map((s) => (
          <View key={s.key} style={{ flexDirection: "row", alignItems: "center", marginBottom: mm(0.5) }}>
            <LegendSwatch s={s} />
            <Text style={{ ...labelStyle(theme), marginLeft: mm(2), width: mm(legendWidth - 9) }}>{s.label}</Text>
          </View>
        ))}
        <Text style={{ ...text(theme, TYPE.footer, WEIGHT.regular, theme.t.label, 1.35), marginTop: mm(2) }}>
          {pdfFr.compteRendu.audiogram.abbreviations}
          {hasNoResponse ? ` · ${pdfFr.compteRendu.audiogram.noResponse}` : ""}
        </Text>
      </View>
    </View>
  );
}

const nf = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

interface GainBlockProps {
  theme: DocTheme;
  title?: string;
  cols: GainPoint[];
  meanFrequencies: FreqKey[];
  meanGain: number | null;
  labels: { unaided: string; aided: string };
  note?: string;
}

/** Un tableau de gain (sans / avec / gain) par fréquence, moyenne en SemiBold. */
function GainBlock({ theme, title, cols, meanFrequencies, meanGain, labels, note }: GainBlockProps) {
  if (cols.length === 0) return null;
  const T = pdfFr.compteRendu.gainTable;
  const labelW = 50;
  const meanW = 22;
  const colW = (CONTENT_WIDTH - labelW - meanW) / cols.length;
  const mean = (pick: (p: GainPoint) => number) => {
    const used = cols.filter((p) => meanFrequencies.includes(p.freq));
    return used.length ? nf(Math.round((used.reduce((s, p) => s + pick(p), 0) / used.length) * 10) / 10) : "—";
  };
  const rows: { label: string; values: string[]; mean: string }[] = [
    { label: labels.unaided, values: cols.map((p) => nf(p.unaided)), mean: mean((p) => p.unaided) },
    { label: labels.aided, values: cols.map((p) => nf(p.aided)), mean: mean((p) => p.aided) },
    { label: T.gain, values: cols.map((p) => nf(p.gain)), mean: meanGain === null ? "—" : nf(meanGain) },
  ];
  const cell = {
    ...text(theme, TYPE.body, WEIGHT.regular, theme.t.ink, 1.2),
    fontFeatureSettings: [...TABULAR],
    textAlign: "center" as const,
  };
  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    minHeight: mm(8),
    borderBottomWidth: 0.5,
    borderBottomColor: theme.t.hairline,
  };
  return (
    <View wrap={false} style={{ marginTop: mm(2) }}>
      {title ? <Text style={{ ...text(theme, TYPE.body, WEIGHT.semibold, theme.t.ink, 1.3), marginBottom: mm(1) }}>{title}</Text> : null}
      <View style={{ ...rowStyle, borderBottomColor: theme.t.label }}>
        <Text style={{ ...labelStyle(theme), width: mm(labelW) }}>{T.frequency}</Text>
        {cols.map((p) => (
          <Text key={p.freq} style={{ ...labelStyle(theme), width: mm(colW), textAlign: "center" }}>
            {hz(p.freq)}
          </Text>
        ))}
        <Text style={{ ...labelStyle(theme), width: mm(meanW), textAlign: "center" }}>{T.mean}</Text>
      </View>
      {rows.map((r, i) => (
        <View key={r.label} style={rowStyle}>
          <Text style={{ ...labelStyle(theme), width: mm(labelW), color: i === 2 ? theme.t.ink : theme.t.label }}>
            {r.label}
          </Text>
          {r.values.map((v, j) => (
            <Text key={j} style={{ ...cell, width: mm(colW) }}>
              {v}
            </Text>
          ))}
          <Text style={{ ...cell, width: mm(meanW), fontWeight: WEIGHT.semibold }}>{r.mean}</Text>
        </View>
      ))}
      {meanFrequencies.length || note ? (
        <Text style={{ ...text(theme, TYPE.footer, WEIGHT.regular, theme.t.label, 1.35), marginTop: mm(1) }}>
          {[meanFrequencies.length ? T.meanNote(meanFrequencies.map(hz).join(", ")) : "", note ?? ""].filter(Boolean).join(" ")}
        </Text>
      ) : null}
    </View>
  );
}

/** Vrai si le gain comporte au moins un tableau à imprimer (binaural ou par oreille). */
export function hasGainTable(gain: GainResult): boolean {
  return gain.perFrequency.length > 0 || Boolean(gain.perEar.right) || Boolean(gain.perEar.left);
}

/**
 * Gain prothétique : tableau binaural (champ libre sans / avec appareils) puis, s'ils
 * existent, un tableau par oreille appareillée avec la référence utilisée.
 */
export function GainTable({ theme, gain }: { theme: DocTheme; gain: GainResult }) {
  const T = pdfFr.compteRendu.gainTable;
  const ears = (["right", "left"] as const).filter((e) => gain.perEar[e]);
  const several = (gain.perFrequency.length ? 1 : 0) + ears.length > 1;
  if (!hasGainTable(gain)) return null;
  return (
    <View>
      {gain.perFrequency.length ? (
        <GainBlock
          theme={theme}
          title={several ? T.binaural : undefined}
          cols={gain.perFrequency}
          meanFrequencies={gain.meanFrequencies}
          meanGain={gain.meanSource === "free_field" ? gain.mean : null}
          labels={{ unaided: T.unaided, aided: T.aided }}
        />
      ) : null}
      {ears.map((e) => {
        const g = gain.perEar[e]!;
        return (
          <View key={e} style={{ marginTop: several ? mm(3) : 0 }}>
            <GainBlock
              theme={theme}
              title={T.ear[e]}
              cols={g.perFrequency}
              meanFrequencies={g.meanFrequencies}
              meanGain={g.mean}
              labels={{ unaided: T.reference[g.reference], aided: T.aidedEar }}
              note={T.referenceNote[g.reference]}
            />
          </View>
        );
      })}
    </View>
  );
}
