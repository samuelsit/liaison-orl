import type { Audiometry, Curve, FreqKey, Measure, Speech } from "@/lib/schemas/audiometry";
import { FREQ_KEYS } from "@/lib/schemas/audiometry";
import type { CompteRenduData } from "@/lib/schemas/document";

/** Fréquences de la perte moyenne BIAP (recommandation 02/1 bis). */
export const BIAP_FREQS: FreqKey[] = ["500", "1000", "2000", "4000"];
const MAX_DB = 120;

export const BIAP_RULE =
  "Classification BIAP (recommandation 02/1 bis) : perte moyenne en conduction aérienne à 500, 1000, 2000 et 4000 Hz ; seuils supérieurs à 120 dB et absences de réponse comptés 120 dB.";
export const BIAP_GLOBAL_RULE = "Perte bilatérale : (7 × meilleure oreille + 3 × moins bonne oreille) / 10.";

export interface PtaResult {
  value: number | null;
  missing: FreqKey[];
}

function effective(m: Measure | undefined): number | null {
  if (!m) return null;
  if (m.noResponse) return MAX_DB;
  if (m.value === null) return null;
  return Math.min(m.value, MAX_DB);
}

/** Perte auditive moyenne BIAP d'une courbe en conduction aérienne. */
export function ptaBiap(curve: Curve | undefined): PtaResult {
  const missing: FreqKey[] = [];
  const values: number[] = [];
  for (const f of BIAP_FREQS) {
    const v = effective(curve?.[f]);
    if (v === null) missing.push(f);
    else values.push(v);
  }
  if (missing.length) return { value: null, missing };
  return { value: round1(values.reduce((a, b) => a + b, 0) / values.length), missing };
}

export type BiapClassKey =
  | "normale"
  | "legere"
  | "moyenne1"
  | "moyenne2"
  | "severe1"
  | "severe2"
  | "profonde1"
  | "profonde2"
  | "profonde3"
  | "totale";

export interface BiapClass {
  key: BiapClassKey;
  label: string;
  degree: CompteRenduData["degree"];
}

const CLASSES: { max: number; key: BiapClassKey; label: string; degree: CompteRenduData["degree"] }[] = [
  { max: 20, key: "normale", label: "Audition normale ou subnormale", degree: null },
  { max: 40, key: "legere", label: "Déficience auditive légère", degree: "legere" },
  { max: 55, key: "moyenne1", label: "Déficience auditive moyenne (1er degré)", degree: "moyenne" },
  { max: 70, key: "moyenne2", label: "Déficience auditive moyenne (2e degré)", degree: "moyenne" },
  { max: 80, key: "severe1", label: "Déficience auditive sévère (1er degré)", degree: "severe" },
  { max: 90, key: "severe2", label: "Déficience auditive sévère (2e degré)", degree: "severe" },
  { max: 100, key: "profonde1", label: "Déficience auditive profonde (1er degré)", degree: "profonde" },
  { max: 110, key: "profonde2", label: "Déficience auditive profonde (2e degré)", degree: "profonde" },
  { max: 119, key: "profonde3", label: "Déficience auditive profonde (3e degré)", degree: "profonde" },
];

/** Classe BIAP d'une perte moyenne (arrondie au dB le plus proche). */
export function biapClass(pta: number): BiapClass {
  const v = Math.round(pta);
  const found = CLASSES.find((c) => v <= c.max);
  return found ?? { key: "totale", label: "Déficience auditive totale (cophose)", degree: "profonde" };
}

/** Perte globale bilatérale BIAP (pondération 7/3). */
export function globalLoss(right: number | null, left: number | null): number | null {
  if (right === null && left === null) return null;
  if (right === null) return left;
  if (left === null) return right;
  const best = Math.min(right, left);
  const worst = Math.max(right, left);
  return round1((7 * best + 3 * worst) / 10);
}

export interface DegreeSuggestion {
  right: PtaResult & { class: BiapClass | null };
  left: PtaResult & { class: BiapClass | null };
  global: number | null;
  globalClass: BiapClass | null;
  degree: CompteRenduData["degree"];
  ears: CompteRenduData["ears"];
  rule: string;
}

const fmt = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Degré de surdité et oreille(s) suggérés à partir de l'audiométrie tonale. */
export function suggestDegree(a: Audiometry): DegreeSuggestion {
  const r = ptaBiap(a.right.air);
  const l = ptaBiap(a.left.air);
  const right = { ...r, class: r.value === null ? null : biapClass(r.value) };
  const left = { ...l, class: l.value === null ? null : biapClass(l.value) };
  const global = globalLoss(r.value, l.value);
  const globalClass = global === null ? null : biapClass(global);
  const rightAffected = r.value !== null && Math.round(r.value) > 20;
  const leftAffected = l.value !== null && Math.round(l.value) > 20;
  const ears: CompteRenduData["ears"] = rightAffected && leftAffected ? "deux" : rightAffected ? "droite" : leftAffected ? "gauche" : null;
  const parts: string[] = [];
  if (r.value !== null) parts.push(`OD ${fmt(r.value)} dB`);
  else parts.push(`OD non calculable (manque ${r.missing.join(", ")} Hz)`);
  if (l.value !== null) parts.push(`OG ${fmt(l.value)} dB`);
  else parts.push(`OG non calculable (manque ${l.missing.join(", ")} Hz)`);
  const globalText =
    global !== null && r.value !== null && l.value !== null
      ? ` ; perte globale (7 × ${fmt(Math.min(r.value, l.value))} + 3 × ${fmt(Math.max(r.value, l.value))}) / 10 = ${fmt(global)} dB`
      : "";
  const rule = `${BIAP_RULE} Pertes moyennes : ${parts.join(", ")}${globalText}${globalClass ? ` → ${globalClass.label.toLowerCase()}` : ""}.`;
  return { right, left, global, globalClass, degree: globalClass?.degree ?? null, ears, rule };
}

export interface GainResult {
  perFrequency: { freq: FreqKey; unaided: number; aided: number; gain: number }[];
  /** Gain tonal moyen sur 500/1000/2000/4000 Hz (fréquences disponibles). */
  mean: number | null;
  meanFrequencies: FreqKey[];
  speech: {
    srtUnaided: number | null;
    srtAided: number | null;
    srtGain: number | null;
    scoreUnaided: number | null;
    scoreAided: number | null;
    scoreGain: number | null;
  };
  noise: { snrGain: number | null; scoreGain: number | null } | null;
}

const val = (m: Measure | null | undefined) => (m && m.value !== null && !m.noResponse ? m.value : null);
const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : round1(a - b));

/** Gain prothétique : seuils en champ libre sans appareil − avec appareils ; gains en intelligibilité. */
export function prostheticGain(a: Audiometry): GainResult {
  const perFrequency: GainResult["perFrequency"] = [];
  for (const f of FREQ_KEYS) {
    const u = val(a.freeField.unaided[f]);
    const ai = val(a.freeField.aided[f]);
    if (u !== null && ai !== null) perFrequency.push({ freq: f, unaided: u, aided: ai, gain: round1(u - ai) });
  }
  const forMean = perFrequency.filter((p) => BIAP_FREQS.includes(p.freq));
  const mean = forMean.length ? round1(forMean.reduce((s, p) => s + p.gain, 0) / forMean.length) : null;
  const su: Speech = a.freeField.speechUnaided;
  const sa: Speech = a.freeField.speechAided;
  const speech = {
    srtUnaided: val(su.srt),
    srtAided: val(sa.srt),
    srtGain: diff(val(su.srt), val(sa.srt)),
    scoreUnaided: val(su.maxScore),
    scoreAided: val(sa.maxScore),
    scoreGain: diff(val(sa.maxScore), val(su.maxScore)),
  };
  const n = a.noise;
  const noise = n
    ? { snrGain: diff(val(n.unaidedSnr), val(n.aidedSnr)), scoreGain: diff(val(n.aidedScore), val(n.unaidedScore)) }
    : null;
  return { perFrequency, mean, meanFrequencies: forMean.map((p) => p.freq), speech, noise };
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

/** Nombre de mesures renseignées (pour savoir si une extraction est exploitable). */
export function countMeasures(a: Audiometry): number {
  const curves = [a.right.air, a.right.bone, a.left.air, a.left.bone, a.freeField.unaided, a.freeField.aided];
  return curves.reduce((n, c) => n + Object.values(c).filter((m) => m && (m.value !== null || m.noResponse)).length, 0);
}
