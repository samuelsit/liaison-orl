import type { Audiometry, Curve, FreqKey } from "@/lib/schemas/audiometry";

/** Graduations de l'audiogramme (Hz) — échelle logarithmique 125 → 8000 Hz. */
export const CHART_FREQS: FreqKey[] = ["125", "250", "500", "750", "1000", "1500", "2000", "3000", "4000", "6000", "8000"];
export const CHART_MAJOR: FreqKey[] = ["125", "250", "500", "1000", "2000", "4000", "8000"];
export const DB_MIN = -10;
export const DB_MAX = 120;

/** Couleurs conventionnelles : oreille droite en rouge, gauche en bleu. */
export const EAR_COLORS = { right: "#C62828", left: "#1565C0", unaided: "#5F6B7A", aided: "#1E7B4A" } as const;

export function xForFreq(freq: number, x0: number, width: number): number {
  return x0 + (Math.log2(freq / 125) / 6) * width;
}

export function yForDb(db: number, y0: number, height: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  return y0 + ((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * height;
}

export type Marker = "O" | "X" | "<" | ">" | "S" | "A";

export interface ChartPoint {
  freq: number;
  db: number;
  noResponse: boolean;
  lowConfidence: boolean;
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  marker: Marker;
  dashed: boolean;
  points: ChartPoint[];
}

function points(curve: Curve): ChartPoint[] {
  return CHART_FREQS.flatMap((f): ChartPoint[] => {
    const m = curve[f];
    if (!m) return [];
    if (m.noResponse) return [{ freq: Number(f), db: DB_MAX, noResponse: true, lowConfidence: m.confidence === "low" }];
    if (m.value === null) return [];
    return [{ freq: Number(f), db: m.value, noResponse: false, lowConfidence: m.confidence === "low" }];
  });
}

export function earSeries(a: Audiometry, ear: "right" | "left"): ChartSeries[] {
  const e = a[ear];
  const color = EAR_COLORS[ear];
  return [
    { key: `${ear}-air`, label: ear === "right" ? "OD — conduction aérienne" : "OG — conduction aérienne", color, marker: ear === "right" ? "O" : "X", dashed: false, points: points(e.air) },
    { key: `${ear}-bone`, label: ear === "right" ? "OD — conduction osseuse" : "OG — conduction osseuse", color, marker: ear === "right" ? "<" : ">", dashed: true, points: points(e.bone) },
  ];
}

export function freeFieldSeries(a: Audiometry): ChartSeries[] {
  return [
    { key: "ff-unaided", label: "Champ libre sans appareil", color: EAR_COLORS.unaided, marker: "S", dashed: true, points: points(a.freeField.unaided) },
    { key: "ff-aided", label: "Champ libre avec appareils", color: EAR_COLORS.aided, marker: "A", dashed: false, points: points(a.freeField.aided) },
  ];
}

/** Chemin SVG d'un symbole d'audiogramme centré en (x, y). */
export function markerPath(marker: Marker, x: number, y: number, r: number): string {
  switch (marker) {
    case "O":
      return `M ${x + r} ${y} A ${r} ${r} 0 1 1 ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} Z`;
    case "X":
      return `M ${x - r} ${y - r} L ${x + r} ${y + r} M ${x + r} ${y - r} L ${x - r} ${y + r}`;
    case "<":
      return `M ${x + r * 0.6} ${y - r} L ${x - r * 0.6} ${y} L ${x + r * 0.6} ${y + r}`;
    case ">":
      return `M ${x - r * 0.6} ${y - r} L ${x + r * 0.6} ${y} L ${x - r * 0.6} ${y + r}`;
    case "S":
      return `M ${x + r * 0.7} ${y - r * 0.8} C ${x - r * 0.9} ${y - r * 1.2}, ${x - r} ${y}, ${x} ${y} C ${x + r} ${y}, ${x + r * 0.9} ${y + r * 1.2}, ${x - r * 0.7} ${y + r * 0.8}`;
    case "A":
      return `M ${x - r * 0.8} ${y + r} L ${x} ${y - r} L ${x + r * 0.8} ${y + r} M ${x - r * 0.45} ${y + r * 0.2} L ${x + r * 0.45} ${y + r * 0.2}`;
  }
}

/** Flèche « absence de réponse » sous le symbole. */
export function noResponseArrow(x: number, y: number, r: number): string {
  return `M ${x} ${y + r} L ${x + r * 1.2} ${y + r * 2.6} M ${x + r * 1.2} ${y + r * 2.6} L ${x + r * 0.2} ${y + r * 2.4} M ${x + r * 1.2} ${y + r * 2.6} L ${x + r * 1.1} ${y + r * 1.6}`;
}

export function polyline(series: ChartSeries, x0: number, y0: number, w: number, h: number): string {
  const pts = series.points.filter((p) => !p.noResponse);
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xForFreq(p.freq, x0, w).toFixed(2)} ${yForDb(p.db, y0, h).toFixed(2)}`).join(" ");
}

export function freqLabel(f: FreqKey): string {
  const n = Number(f);
  return n >= 1000 ? `${n / 1000}k`.replace(".", ",") : String(n);
}
