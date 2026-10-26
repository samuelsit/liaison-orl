import type { Audiometry, Curve, FreqKey, Measure, NoiseTest, Speech } from "@/lib/schemas/audiometry";
import { FREQ_KEYS, MAIN_FREQUENCIES } from "@/lib/schemas/audiometry";

/*
 * Modèle d'affichage de l'audiométrie (tableau de correction, saisie mobile,
 * audiogrammes) : fonctions pures, sans effet sur les calculs (BIAP, gain).
 */

export type CurvePath = "right.air" | "right.bone" | "left.air" | "left.bone" | "freeField.unaided" | "freeField.aided";
export type EarGroup = "right" | "left" | "freeField";
export type CurveKind = "air" | "bone" | "unaided" | "aided";
export type SpeechTarget = "right" | "left" | "speechUnaided" | "speechAided";
export type SpeechKey = keyof Speech;
export type NoiseKey = "unaidedSnr" | "aidedSnr" | "unaidedScore" | "aidedScore";

export interface GridRow {
  path: CurvePath;
  ear: EarGroup;
  kind: CurveKind;
  /** Symbole d'audiogramme (O, <, X, >, S, A). */
  marker: "O" | "<" | "X" | ">" | "S" | "A";
  /** Préfixe du nom accessible des cases (« OD — aérienne »). */
  label: string;
}

export const GRID_ROWS: readonly GridRow[] = [
  { path: "right.air", ear: "right", kind: "air", marker: "O", label: "OD — aérienne" },
  { path: "right.bone", ear: "right", kind: "bone", marker: "<", label: "OD — osseuse" },
  { path: "left.air", ear: "left", kind: "air", marker: "X", label: "OG — aérienne" },
  { path: "left.bone", ear: "left", kind: "bone", marker: ">", label: "OG — osseuse" },
  { path: "freeField.unaided", ear: "freeField", kind: "unaided", marker: "S", label: "Champ libre sans" },
  { path: "freeField.aided", ear: "freeField", kind: "aided", marker: "A", label: "Champ libre avec" },
];

export const SPEECH_TARGETS: readonly SpeechTarget[] = ["right", "left", "speechUnaided", "speechAided"];
export const SPEECH_KEYS: readonly SpeechKey[] = ["srt", "maxScore", "maxScoreLevel"];
export const NOISE_KEYS: readonly NoiseKey[] = ["unaidedSnr", "aidedSnr", "unaidedScore", "aidedScore"];

export const INTERMEDIATE_FREQS: readonly FreqKey[] = ["750", "1500"];
const MAIN_KEYS = MAIN_FREQUENCIES.map(String) as FreqKey[];

/** Fréquences affichées : principales, plus 750 / 1 500 Hz si demandé. */
export function visibleFrequencies(withIntermediate: boolean): FreqKey[] {
  return withIntermediate ? [...FREQ_KEYS] : MAIN_KEYS;
}

export function getCurve(a: Audiometry, path: CurvePath): Curve {
  const [k1, k2] = path.split(".") as [EarGroup, string];
  return (a[k1] as unknown as Record<string, Curve>)[k2] ?? {};
}

export function setCurve(a: Audiometry, path: CurvePath, c: Curve): Audiometry {
  const [k1, k2] = path.split(".") as [EarGroup, string];
  return { ...a, [k1]: { ...a[k1], [k2]: c } } as Audiometry;
}

export function setCurveMeasure(a: Audiometry, path: CurvePath, f: FreqKey, m: Measure | null): Audiometry {
  const c = { ...getCurve(a, path) };
  if (m) c[f] = m;
  else delete c[f];
  return setCurve(a, path, c);
}

export function getSpeech(a: Audiometry, target: SpeechTarget): Speech {
  return target === "right" || target === "left" ? a[target].speech : a.freeField[target];
}

export function setSpeechMeasure(a: Audiometry, target: SpeechTarget, key: SpeechKey, m: Measure | null): Audiometry {
  if (target === "right" || target === "left") return { ...a, [target]: { ...a[target], speech: { ...a[target].speech, [key]: m } } };
  return { ...a, freeField: { ...a.freeField, [target]: { ...a.freeField[target], [key]: m } } };
}

const EMPTY_NOISE: NoiseTest = { testName: null, unaidedSnr: null, aidedSnr: null, unaidedScore: null, aidedScore: null };

export function setNoiseMeasure(a: Audiometry, key: NoiseKey, m: Measure | null): Audiometry {
  return { ...a, noise: { ...(a.noise ?? EMPTY_NOISE), [key]: m } };
}

export function setNoiseName(a: Audiometry, name: string): Audiometry {
  return { ...a, noise: { ...(a.noise ?? EMPTY_NOISE), testName: name || null } };
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

/** Référence d'une mesure, dans l'ordre de lecture du tableau. */
export type MeasureRef =
  | { kind: "curve"; path: CurvePath; freq: FreqKey }
  | { kind: "speech"; target: SpeechTarget; key: SpeechKey }
  | { kind: "noise"; key: NoiseKey };

export function refId(r: MeasureRef): string {
  if (r.kind === "curve") return `curve:${r.path}:${r.freq}`;
  if (r.kind === "speech") return `speech:${r.target}:${r.key}`;
  return `noise:${r.key}`;
}

export function getMeasure(a: Audiometry, r: MeasureRef): Measure | null {
  if (r.kind === "curve") return getCurve(a, r.path)[r.freq] ?? null;
  if (r.kind === "speech") return getSpeech(a, r.target)[r.key] ?? null;
  return a.noise?.[r.key] ?? null;
}

export function setMeasure(a: Audiometry, r: MeasureRef, m: Measure | null): Audiometry {
  if (r.kind === "curve") return setCurveMeasure(a, r.path, r.freq, m);
  if (r.kind === "speech") return setSpeechMeasure(a, r.target, r.key, m);
  return setNoiseMeasure(a, r.key, m);
}

/** Toutes les mesures présentes (tonale, vocale, bruit), dans l'ordre du tableau. */
export function listMeasures(a: Audiometry): MeasureRef[] {
  const refs: MeasureRef[] = [];
  for (const row of GRID_ROWS) {
    const c = getCurve(a, row.path);
    for (const f of FREQ_KEYS) if (c[f]) refs.push({ kind: "curve", path: row.path, freq: f });
  }
  for (const t of SPEECH_TARGETS) for (const k of SPEECH_KEYS) if (getSpeech(a, t)[k]) refs.push({ kind: "speech", target: t, key: k });
  for (const k of NOISE_KEYS) if (a.noise?.[k]) refs.push({ kind: "noise", key: k });
  return refs;
}

/** Valeurs lues avec une confiance faible (à vérifier), tonale, vocale et bruit compris. */
export function listLowConfidence(a: Audiometry): MeasureRef[] {
  return listMeasures(a).filter((r) => getMeasure(a, r)?.confidence === "low");
}

/** Marque une valeur comme relue (confiance élevée), sans changer sa valeur. */
export function markChecked(a: Audiometry, r: MeasureRef): Audiometry {
  const m = getMeasure(a, r);
  if (!m || m.confidence === "high") return a;
  return setMeasure(a, r, { ...m, confidence: "high" });
}

/** Vrai si une courbe contient une valeur à 750 ou 1 500 Hz (affichage des fréquences intermédiaires). */
export function hasIntermediateValues(a: Audiometry): boolean {
  return GRID_ROWS.some((row) => INTERMEDIATE_FREQS.some((f) => getCurve(a, row.path)[f] !== undefined));
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
  "left-air": "left.air",
  "left-bone": "left.bone",
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

/** Format français d'un nombre de dB (une décimale au plus). */
export function formatNumber(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }).replace("-", "−");
}

/** Nombre signé (« +20 », « −3 », « 0 »). */
export function formatSigned(v: number): string {
  return `${v > 0 ? "+" : ""}${formatNumber(v)}`;
}

/** Libellé lisible d'une fréquence : « 750 Hz », « 1 kHz », « 1,5 kHz ». */
export function freqLong(f: FreqKey | number): string {
  const n = Number(f);
  return n >= 1000 ? `${String(n / 1000).replace(".", ",")} kHz` : `${n} Hz`;
}
