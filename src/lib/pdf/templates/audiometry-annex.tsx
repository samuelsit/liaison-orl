import "server-only";
import { Fragment } from "react";
import { Path, Rect as SvgRect, Svg, View } from "@react-pdf/renderer";
import type { Audiometry, FreqKey, Measure } from "@/lib/schemas/audiometry";
import { MAIN_FREQUENCIES } from "@/lib/schemas/audiometry";
import { CHART_FREQS, CHART_MAJOR, DB_MAX, DB_MIN, earSeries, freeFieldSeries, freqLabel, markerPath, noResponseArrow, polyline, xForFreq, yForDb, type ChartSeries } from "@/lib/audiology/chart";
import { prostheticGain, suggestDegree } from "@/lib/audiology/calculations";
import type { PdfBrand } from "../model";
import { HLine, Rect, T } from "../primitives";
import { wrapText } from "../layout";

const fmt = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${unit}`);

function Chart({ x, y, w, h, title, series, brand }: { x: number; y: number; w: number; h: number; title: string; series: ChartSeries[]; brand: PdfBrand }) {
  const c = brand.colors;
  const f = brand.font;
  const cx0 = 24;
  const cy0 = 4;
  const cw = w - cx0 - 6;
  const ch = h;
  const gridDb: number[] = [];
  for (let db = DB_MIN; db <= DB_MAX; db += 10) gridDb.push(db);
  return (
    <>
      <T x={x} y={y} size={9} font={f} weight={700} color={c.primary} width={w}>
        {title}
      </T>
      <View style={{ position: "absolute", left: x, top: y + 6, width: w, height: ch + 10 }}>
        <Svg width={w} height={ch + 10} viewBox={`0 0 ${w} ${ch + 10}`}>
          <SvgRect x={cx0} y={cy0} width={cw} height={ch} fill="#FFFFFF" stroke={c.muted} strokeWidth={0.6} />
          {gridDb.map((db) => (
            <Path key={db} d={`M ${cx0} ${yForDb(db, cy0, ch)} L ${cx0 + cw} ${yForDb(db, cy0, ch)}`} stroke={db === 20 ? c.border : "#D7DCE4"} strokeWidth={db === 20 ? 0.6 : 0.35} />
          ))}
          {CHART_FREQS.map((fk) => (
            <Path
              key={fk}
              d={`M ${xForFreq(Number(fk), cx0, cw)} ${cy0} L ${xForFreq(Number(fk), cx0, cw)} ${cy0 + ch}`}
              stroke="#D7DCE4"
              strokeWidth={CHART_MAJOR.includes(fk) ? 0.45 : 0.25}
              strokeDasharray={CHART_MAJOR.includes(fk) ? undefined : "1.5,1.5"}
            />
          ))}
          {series.map((s) => (
            <Fragment key={s.key}>
              <Path d={polyline(s, cx0, cy0, cw, ch)} fill="none" stroke={s.color} strokeWidth={1} strokeDasharray={s.dashed ? "3,2" : undefined} />
              {s.points.map((p) => {
                const px = xForFreq(p.freq, cx0, cw);
                const py = yForDb(p.db, cy0, ch);
                return (
                  <Fragment key={`${s.key}-${p.freq}`}>
                    <Path d={markerPath(s.marker, px, py, 3.2)} fill={s.marker === "O" ? "#FFFFFF" : "none"} stroke={s.color} strokeWidth={1.1} />
                    {p.noResponse ? <Path d={noResponseArrow(px, py, 3.2)} fill="none" stroke={s.color} strokeWidth={0.9} /> : null}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </Svg>
      </View>
      {gridDb
        .filter((db) => db % 20 === 0 && db < DB_MAX)
        .map((db) => (
          <T key={db} x={x + cx0 - 3} y={y + 6 + yForDb(db, cy0, ch) + 2.2} size={6} font={f} color={c.text} align="right" width={22}>
            {String(db)}
          </T>
        ))}
      {CHART_MAJOR.map((fk) => (
        <T key={fk} x={x + xForFreq(Number(fk), cx0, cw)} y={y + 6 + cy0 + ch + 8} size={6} font={f} color={c.text} align="center" width={24}>
          {freqLabel(fk)}
        </T>
      ))}
    </>
  );
}

function cell(m: Measure | undefined): string {
  if (!m) return "";
  if (m.noResponse) return "NR";
  return m.value === null ? "" : String(m.value);
}

export function AudiometryAnnex({ audiometry: a, brand, top }: { audiometry: Audiometry; brand: PdfBrand; top: number }) {
  const c = brand.colors;
  const f = brand.font;
  const s = suggestDegree(a);
  const g = prostheticGain(a);
  const chartH = 150;
  const freqs = MAIN_FREQUENCIES.map(String) as FreqKey[];
  const rows: { label: string; values: (string | number)[]; pta?: string; color?: string }[] = [
    { label: "OD — aérienne", values: freqs.map((k) => cell(a.right.air[k])), pta: fmt(s.right.value, " dB"), color: "#C62828" },
    { label: "OD — osseuse", values: freqs.map((k) => cell(a.right.bone[k])), color: "#C62828" },
    { label: "OG — aérienne", values: freqs.map((k) => cell(a.left.air[k])), pta: fmt(s.left.value, " dB"), color: "#1565C0" },
    { label: "OG — osseuse", values: freqs.map((k) => cell(a.left.bone[k])), color: "#1565C0" },
    { label: "Champ libre sans", values: freqs.map((k) => cell(a.freeField.unaided[k])) },
    { label: "Champ libre avec", values: freqs.map((k) => cell(a.freeField.aided[k])) },
    { label: "Gain prothétique", values: freqs.map((k) => g.perFrequency.find((p) => p.freq === k)?.gain ?? ""), pta: fmt(g.mean, " dB") },
  ];
  const tableTop = top + chartH + 40;
  const colX0 = 42.52;
  const labelW = 92;
  const colW = 40;
  const ptaX = colX0 + labelW + colW * freqs.length;
  const rowH = 13.5;
  const summaryTop = tableTop + rowH * (rows.length + 1) + 22;

  const summary: [string, string][] = [
    ["Perte moyenne OD", s.right.value === null ? "non calculable" : `${fmt(s.right.value, " dB")} — ${s.right.class?.label.toLowerCase()}`],
    ["Perte moyenne OG", s.left.value === null ? "non calculable" : `${fmt(s.left.value, " dB")} — ${s.left.class?.label.toLowerCase()}`],
    ["Perte globale (BIAP)", s.global === null ? "non calculable" : `${fmt(s.global, " dB")} — ${s.globalClass?.label.toLowerCase()}`],
    ["Gain tonal moyen", g.mean === null ? "non mesuré" : `${fmt(g.mean, " dB")} (${g.meanFrequencies.map(freqLabel).join(", ")} Hz)`],
    [
      "Seuil d'intelligibilité",
      g.speech.srtUnaided === null && g.speech.srtAided === null ? "non mesuré" : `${fmt(g.speech.srtUnaided, " dB")} sans → ${fmt(g.speech.srtAided, " dB")} avec${g.speech.srtGain !== null ? ` (gain ${fmt(g.speech.srtGain, " dB")})` : ""}`,
    ],
    [
      "Intelligibilité maximale",
      g.speech.scoreUnaided === null && g.speech.scoreAided === null ? "non mesurée" : `${fmt(g.speech.scoreUnaided, " %")} sans → ${fmt(g.speech.scoreAided, " %")} avec${g.speech.scoreGain !== null ? ` (${g.speech.scoreGain >= 0 ? "+" : ""}${fmt(g.speech.scoreGain)} points)` : ""}`,
    ],
  ];
  if (g.noise) {
    summary.push([
      `Dans le bruit${a.noise?.testName ? ` (${a.noise.testName})` : ""}`,
      [g.noise.snrGain !== null ? `gain RSB ${fmt(g.noise.snrGain, " dB")}` : null, g.noise.scoreGain !== null ? `${g.noise.scoreGain >= 0 ? "+" : ""}${fmt(g.noise.scoreGain)} points` : null].filter(Boolean).join(", ") || "—",
    ]);
  }
  const ruleLines = wrapText(s.rule, { family: f, weight: 400, size: 6.8 }, 250);

  return (
    <>
      <Chart x={42.52} y={top + 10} w={245} h={chartH} title="Oreille droite (OD)" series={earSeries(a, "right")} brand={brand} />
      <Chart x={307.76} y={top + 10} w={245} h={chartH} title="Oreille gauche (OG)" series={earSeries(a, "left")} brand={brand} />

      {/* Tableau des seuils (dB HL) */}
      <Rect x={colX0} y={tableTop} w={ptaX + 50 - colX0} h={rowH} fill={c.surface} />
      <T x={colX0 + 4} y={tableTop + 9.5} size={7} font={f} weight={700} color={c.primary} width={labelW}>
        Seuils (dB HL)
      </T>
      {freqs.map((k, i) => (
        <T key={k} x={colX0 + labelW + colW * i + colW / 2} y={tableTop + 9.5} size={7} font={f} weight={700} color={c.primary} align="center" width={colW}>
          {freqLabel(k)}
        </T>
      ))}
      <T x={ptaX + 25} y={tableTop + 9.5} size={7} font={f} weight={700} color={c.primary} align="center" width={50}>
        Moyenne
      </T>
      {rows.map((r, ri) => {
        const ry = tableTop + rowH * (ri + 1);
        return (
          <Fragment key={r.label}>
            <HLine x1={colX0} x2={ptaX + 50} y={ry + rowH} color="#E1E5EC" width={0.4} />
            <T x={colX0 + 4} y={ry + 9.5} size={7} font={f} weight={600} color={r.color ?? c.text} width={labelW}>
              {r.label}
            </T>
            {r.values.map((v, i) => (
              <T key={i} x={colX0 + labelW + colW * i + colW / 2} y={ry + 9.5} size={7} font={f} color={c.text} align="center" width={colW}>
                {String(v)}
              </T>
            ))}
            {r.pta ? (
              <T x={ptaX + 25} y={ry + 9.5} size={7} font={f} weight={700} color={c.text} align="center" width={50}>
                {r.pta}
              </T>
            ) : null}
          </Fragment>
        );
      })}

      <Chart x={42.52} y={summaryTop} w={245} h={chartH - 20} title="Champ libre : sans (S) / avec (A) appareils" series={freeFieldSeries(a)} brand={brand} />
      <Rect x={307.76} y={summaryTop - 4} w={245} h={chartH + 40} fill={c.surface} stroke={c.border} strokeWidth={0.5} radius={5} />
      <T x={317} y={summaryTop + 9} size={8.5} font={f} weight={700} color={c.primary} width={230}>
        Synthèse
      </T>
      {summary.map(([label, value], i) => (
        <Fragment key={label}>
          <T x={317} y={summaryTop + 26 + i * 21} size={7.5} font={f} weight={700} color={c.text} width={230}>
            {label}
          </T>
          <T x={317} y={summaryTop + 36 + i * 21} size={7.5} font={f} color={c.text} width={230}>
            {value}
          </T>
        </Fragment>
      ))}
      {ruleLines.slice(0, 6).map((line, i) => (
        <T key={i} x={42.52} y={summaryTop + chartH + 14 + i * 8.5} size={6.8} font={f} color={c.muted} width={250}>
          {line}
        </T>
      ))}
    </>
  );
}
