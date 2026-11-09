import type { Audiometry, Curve, FreqKey, Measure } from "@/lib/schemas/audiometry";
import { FREQ_KEYS, MAIN_FREQUENCIES } from "@/lib/schemas/audiometry";
import { gainReference } from "@/lib/audiology/calculations";
import { CURVE_PATHS, getCurve, setCurveMeasure, type CurvePath, type EarGroup, type MeasureRef, type NoiseKey, type SpeechKey, type SpeechTarget } from "@/lib/audiology/refs";

/*
 * Modèle d'affichage de l'audiométrie (tableau de correction, saisie mobile,
 * audiogrammes) : fonctions pures, sans effet sur les calculs (BIAP, gain).
 * L'accès aux mesures par référence vit dans `@/lib/audiology/refs` (partagé avec la fusion).
 */

export {
  CURVE_PATHS,
  getCurve,
  getMeasure,
  getSpeech,
  listLowConfidence,
  listMeasures,
  markChecked,
  NOISE_KEYS,
  refId,
  setCurve,
  setCurveMeasure,
  setMeasure,
  setNoiseMeasure,
  setNoiseName,
  setSpeechMeasure,
  SPEECH_KEYS,
  SPEECH_TARGETS,
  type CurvePath,
  type EarGroup,
  type MeasureRef,
  type NoiseKey,
  type SpeechKey,
  type SpeechTarget,
} from "@/lib/audiology/refs";

/** `earAided` : champ libre avec appareil, une oreille seule. */
export type CurveKind = "air" | "bone" | "earAided" | "unaided" | "aided";

export interface GridRow {
  path: CurvePath;
  ear: EarGroup;
  kind: CurveKind;
  /** Symbole d'audiogramme (O, <, X, >, S, A). */
  marker: "O" | "<" | "X" | ">" | "S" | "A";
  /** Préfixe du nom accessible des cases (« OD — aérienne »). */
  label: string;
}

/** Lignes du tableau des seuils, dans l'ordre de `CURVE_PATHS`. */
export const GRID_ROWS: readonly GridRow[] = [
  { path: "right.air", ear: "right", kind: "air", marker: "O", label: "OD — aérienne" },
  { path: "right.bone", ear: "right", kind: "bone", marker: "<", label: "OD — osseuse" },
  { path: "right.aided", ear: "right", kind: "earAided", marker: "A", label: "OD — appareillée" },
  { path: "left.air", ear: "left", kind: "air", marker: "X", label: "OG — aérienne" },
  { path: "left.bone", ear: "left", kind: "bone", marker: ">", label: "OG — osseuse" },
  { path: "left.aided", ear: "left", kind: "earAided", marker: "A", label: "OG — appareillée" },
  { path: "freeField.unaided", ear: "freeField", kind: "unaided", marker: "S", label: "Champ libre sans" },
  { path: "freeField.aided", ear: "freeField", kind: "aided", marker: "A", label: "Champ libre avec" },
];

export const INTERMEDIATE_FREQS: readonly FreqKey[] = ["750", "1500"];
const MAIN_KEYS = MAIN_FREQUENCIES.map(String) as FreqKey[];

/** Fréquences affichées : principales, plus 750 / 1 500 Hz si demandé. */
export function visibleFrequencies(withIntermediate: boolean): FreqKey[] {
  return withIntermediate ? [...FREQ_KEYS] : MAIN_KEYS;
}

export type ParsedCell = { value: number | null; noResponse: boolean };

/** Lecture d'une case : nombre (virgule acceptée), « NR » / « AR » / « N » pour absence de réponse, vide. */
export function parseCell(raw: string, max = 140): ParsedCell | "invalid" {
  const v = raw.trim().toUpperCase();
  if (v === "" || v === "—" || v === "-") return { value: null, noResponse: false };
  if (v === "NR" || v === "AR" || v === "N" || v === "↓") return { value: null, noResponse: true };
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < -20 || n > max) return "invalid";
  return { value: n, noResponse: false };
}

/** Mesure saisie à la main (confiance élevée), ou null pour une case vide. */
export function toMeasure(p: ParsedCell): Measure | null {
  if (p.value === null && !p.noResponse) return null;
  return { value: p.value, confidence: "high", ...(p.noResponse ? { noResponse: true } : {}) };
}

export function cellText(m: Measure | undefined | null): string {
  if (!m) return "";
  if (m.noResponse) return "NR";
  return m.value === null ? "" : String(m.value).replace(".", ",");
}

/** Vrai si une courbe contient une valeur à 750 ou 1 500 Hz (affichage des fréquences intermédiaires). */
export function hasIntermediateValues(a: Audiometry): boolean {
  return CURVE_PATHS.some((path) => INTERMEDIATE_FREQS.some((f) => getCurve(a, path)[f] !== undefined));
}

/**
 * Collage d'une série de valeurs (« 20 25 30 35 », tabulations ou points-virgules).
 * Renvoie null s'il n'y a qu'une valeur (collage ordinaire) ou si une valeur est invalide.
 */
export function parsePastedValues(text: string): ParsedCell[] | null {
  const tokens = text
    .trim()
    .split(/[\t;\s]+/)
    .filter(Boolean);
  if (tokens.length < 2) return null;
  const cells: ParsedCell[] = [];
  for (const t of tokens) {
    const p = parseCell(t);
    if (p === "invalid") return null;
    cells.push(p);
  }
  return cells;
}

/** Remplit une ligne à partir d'une fréquence ; les valeurs en trop sont ignorées. */
export function applyRowPaste(
  a: Audiometry,
  path: CurvePath,
  freqs: readonly FreqKey[],
  startFreq: FreqKey,
  values: readonly ParsedCell[],
): { next: Audiometry; count: number } {
  const start = freqs.indexOf(startFreq);
  if (start < 0) return { next: a, count: 0 };
  let next = a;
  let count = 0;
  for (let i = 0; i < values.length && start + i < freqs.length; i++) {
    next = setCurveMeasure(next, path, freqs[start + i]!, toMeasure(values[i]!));
    count++;
  }
  return { next, count };
}

export interface GridPos {
  row: number;
  col: number;
}

export type GridMove = "up" | "down" | "left" | "right" | "rowStart" | "rowEnd" | "enter";

/**
 * Case voisine dans une grille (pas de bouclage : null au bord). « enter » descend,
 * puis passe en haut de la colonne suivante : saisie colonne par colonne au clavier.
 */
export function moveInGrid(pos: GridPos, move: GridMove, rows: number, cols: number): GridPos | null {
  switch (move) {
    case "enter":
      if (pos.row < rows - 1) return { row: pos.row + 1, col: pos.col };
      return pos.col < cols - 1 ? { row: 0, col: pos.col + 1 } : null;
    case "up":
      return pos.row > 0 ? { row: pos.row - 1, col: pos.col } : null;
    case "down":
      return pos.row < rows - 1 ? { row: pos.row + 1, col: pos.col } : null;
    case "left":
      return pos.col > 0 ? { row: pos.row, col: pos.col - 1 } : null;
    case "right":
      return pos.col < cols - 1 ? { row: pos.row, col: pos.col + 1 } : null;
    case "rowStart":
      return pos.col !== 0 ? { row: pos.row, col: 0 } : null;
    case "rowEnd":
      return pos.col !== cols - 1 ? { row: pos.row, col: cols - 1 } : null;
  }
}

/** Correspondance entre les séries de l'audiogramme (chart.ts) et les lignes du tableau. */
const SERIES_TO_PATH: Record<string, CurvePath> = {
  "right-air": "right.air",
  "right-bone": "right.bone",
  "right-aided": "right.aided",
  "left-air": "left.air",
  "left-bone": "left.bone",
  "left-aided": "left.aided",
  "ff-unaided": "freeField.unaided",
  "ff-aided": "freeField.aided",
};

export function seriesKeyToPath(key: string): CurvePath | null {
  return SERIES_TO_PATH[key] ?? null;
}

export function pathToSeriesKey(path: CurvePath): string {
  return Object.entries(SERIES_TO_PATH).find(([, p]) => p === path)![0];
}

export interface GainBand {
  freq: number;
  /** Seuil avec appareils (dB, haut de la bande). */
  aided: number;
  /** Seuil sans appareil (dB, bas de la bande). */
  unaided: number;
}

/** Fréquences où les seuils sans et avec appareils existent tous deux : zone de gain à ombrer. */
export function gainBands(unaided: Curve, aided: Curve): GainBand[] {
  const bands: GainBand[] = [];
  for (const f of FREQ_KEYS) {
    const u = unaided[f];
    const ai = aided[f];
    if (!u || !ai || u.noResponse || ai.noResponse || u.value === null || ai.value === null) continue;
    bands.push({ freq: Number(f), aided: ai.value, unaided: u.value });
  }
  return bands;
}

/** Zone de gain d'une oreille : seuils appareillés de l'oreille contre la même référence que le calcul du gain. */
export function earGainBands(a: Audiometry, ear: "right" | "left"): GainBand[] {
  return gainBands(gainReference(a, ear).curve, a[ear].aided);
}

/** Format français d'un nombre de dB (une décimale au plus). */
export function formatNumber(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }).replace("-", "−");
}

/** Nombre signé (« +20 », « −3 », « 0 »). */
export function formatSigned(v: number): string {
  return `${v > 0 ? "+" : ""}${formatNumber(v)}`;
}

/** Libellé lisible d'une référence de mesure (« OD — aérienne · 1 kHz », « Champ libre avec · Seuil 50 % »). */
export function describeRef(r: MeasureRef, labels: { speechRows: Record<SpeechTarget, string>; speechCols: Record<SpeechKey, { short: string }>; noiseFields: Record<NoiseKey, string> }): string {
  if (r.kind === "curve") return `${GRID_ROWS.find((row) => row.path === r.path)?.label ?? r.path} · ${freqLong(r.freq)}`;
  if (r.kind === "speech") return `${labels.speechRows[r.target]} · ${labels.speechCols[r.key].short}`;
  return labels.noiseFields[r.key];
}

/** Libellé lisible d'une fréquence : « 750 Hz », « 1 kHz », « 1,5 kHz ». */
export function freqLong(f: FreqKey | number): string {
  const n = Number(f);
  return n >= 1000 ? `${String(n / 1000).replace(".", ",")} kHz` : `${n} Hz`;
}
