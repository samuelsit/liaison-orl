import {
  CURVE_PATHS,
  FREQ_KEYS,
  NOISE_KEYS,
  SPEECH_KEYS,
  SPEECH_TARGETS,
  type Audiometry,
  type Curve,
  type CurvePath,
  type FreqKey,
  type Measure,
  type MeasureRef,
  type NoiseKey,
  type NoiseTest,
  type Speech,
  type SpeechKey,
  type SpeechTarget,
} from "@/lib/schemas/audiometry";

/*
 * Accès pur aux mesures d'une audiométrie par référence stable (courbe + fréquence,
 * vocale, bruit). Partagé par le tableau de correction (client) et la fusion de
 * plusieurs bilans (serveur) ; aucun effet sur les calculs (BIAP, gain).
 */

export type { CurvePath, MeasureRef, NoiseKey, SpeechKey, SpeechTarget };
export { CURVE_PATHS, NOISE_KEYS, SPEECH_KEYS, SPEECH_TARGETS };

export type EarGroup = "right" | "left" | "freeField";

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

export const EMPTY_NOISE: NoiseTest = { testName: null, unaidedSnr: null, aidedSnr: null, unaidedScore: null, aidedScore: null };

export function setNoiseMeasure(a: Audiometry, key: NoiseKey, m: Measure | null): Audiometry {
  return { ...a, noise: { ...(a.noise ?? EMPTY_NOISE), [key]: m } };
}

export function setNoiseName(a: Audiometry, name: string): Audiometry {
  return { ...a, noise: { ...(a.noise ?? EMPTY_NOISE), testName: name || null } };
}

export function refId(r: MeasureRef): string {
  if (r.kind === "curve") return `curve:${r.path}:${r.freq}`;
  if (r.kind === "speech") return `speech:${r.target}:${r.key}`;
  return `noise:${r.key}`;
}

export function sameRef(a: MeasureRef, b: MeasureRef): boolean {
  return refId(a) === refId(b);
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

/** Vrai si la mesure porte une information (valeur ou absence de réponse). */
export function isPresent(m: Measure | null | undefined): m is Measure {
  return Boolean(m && (m.value !== null || m.noResponse));
}

/** Toutes les références possibles, dans l'ordre de lecture du tableau (tonale, vocale, bruit). */
export function allRefs(): MeasureRef[] {
  const refs: MeasureRef[] = [];
  for (const path of CURVE_PATHS) for (const f of FREQ_KEYS) refs.push({ kind: "curve", path, freq: f });
  for (const target of SPEECH_TARGETS) for (const key of SPEECH_KEYS) refs.push({ kind: "speech", target, key });
  for (const key of NOISE_KEYS) refs.push({ kind: "noise", key });
  return refs;
}

/** Toutes les mesures présentes (tonale, vocale, bruit), dans l'ordre du tableau. */
export function listMeasures(a: Audiometry): MeasureRef[] {
  return allRefs().filter((r) => getMeasure(a, r) !== null);
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
