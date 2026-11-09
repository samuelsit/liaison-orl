import {
  emptyAudiometry,
  FREQ_KEYS,
  NOISE_KEYS,
  SPEECH_KEYS,
  type Audiometry,
  type BilanCondition,
  type Conflict,
  type ConflictCandidate,
  type Confidence,
  type Curve,
  type Measure,
  type MeasureRef,
  type Speech,
} from "@/lib/schemas/audiometry";
import { allRefs, getMeasure, isPresent, refId, setMeasure } from "./refs";

/*
 * Fusion de plusieurs bilans (tonale, vocale, avec / sans appareils) en une seule
 * audiométrie, en code, de façon déterministe : repli des fichiers dans l'ordre de
 * dépôt, puis superposition des valeurs saisies à la main (sans `source`).
 */

export interface MergeSource {
  id: string;
  fileName: string;
  /** Ordre de dépôt (ISO ou Date) : à égalité de confiance, le plus ancien l'emporte. */
  createdAt: string | Date;
  audiometry: Audiometry;
  condition: BilanCondition;
  /** Le modèle a reconnu une feuille entièrement « avec appareils ». */
  aidedSheet: boolean;
}

export interface MergeResult {
  audiometry: Audiometry;
  conflicts: Conflict[];
}

/** Écart au-delà duquel deux lectures d'un même seuil (dB) sont en conflit. */
export const CONFLICT_DB = 5;

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

const union = (a: Curve, b: Curve): Curve => ({ ...a, ...b });

function fillSpeech(target: Speech, from: Speech): Speech {
  const out = { ...target };
  for (const k of SPEECH_KEYS) if (!isPresent(out[k]) && isPresent(from[k])) out[k] = from[k];
  return out;
}

const EMPTY_SPEECH: Speech = { srt: null, maxScore: null, maxScoreLevel: null };

/**
 * Réinterprète un fichier : « avec appareils » déplace les courbes au casque vers les
 * courbes appareillées par oreille, le champ libre sans vers le champ libre avec, la
 * vocale et le bruit vers leur condition appareillée ; « sans appareil » fait l'inverse.
 * En automatique, seule une feuille reconnue « avec appareils » par le modèle est déplacée.
 */
export function remapCondition(a: Audiometry, condition: BilanCondition, aidedSheet: boolean): Audiometry {
  const mode = condition === "auto" ? (aidedSheet ? "aided" : null) : condition;
  if (mode === null) return a;
  if (mode === "aided") {
    const speechAided = fillSpeech(fillSpeech(fillSpeech(a.freeField.speechAided, a.freeField.speechUnaided), a.right.speech), a.left.speech);
    const noise = a.noise
      ? {
          ...a.noise,
          aidedSnr: isPresent(a.noise.aidedSnr) ? a.noise.aidedSnr : a.noise.unaidedSnr,
          aidedScore: isPresent(a.noise.aidedScore) ? a.noise.aidedScore : a.noise.unaidedScore,
          unaidedSnr: null,
          unaidedScore: null,
        }
      : null;
    return {
      ...a,
      right: { ...a.right, air: {}, aided: union(a.right.air, a.right.aided), speech: { ...EMPTY_SPEECH } },
      left: { ...a.left, air: {}, aided: union(a.left.air, a.left.aided), speech: { ...EMPTY_SPEECH } },
      freeField: { ...a.freeField, unaided: {}, aided: union(a.freeField.unaided, a.freeField.aided), speechUnaided: { ...EMPTY_SPEECH }, speechAided },
      noise,
    };
  }
  const speechUnaided = fillSpeech(a.freeField.speechUnaided, a.freeField.speechAided);
  const noise = a.noise
    ? {
        ...a.noise,
        unaidedSnr: isPresent(a.noise.unaidedSnr) ? a.noise.unaidedSnr : a.noise.aidedSnr,
        unaidedScore: isPresent(a.noise.unaidedScore) ? a.noise.unaidedScore : a.noise.aidedScore,
        aidedSnr: null,
        aidedScore: null,
      }
    : null;
  return {
    ...a,
    right: { ...a.right, air: union(a.right.aided, a.right.air), aided: {} },
    left: { ...a.left, air: union(a.left.aided, a.left.air), aided: {} },
    freeField: { ...a.freeField, unaided: union(a.freeField.aided, a.freeField.unaided), aided: {}, speechUnaided, speechAided: { ...EMPTY_SPEECH } },
    noise,
  };
}

/** Mesures en pourcentage : la moindre différence est un conflit. */
function isPercent(r: MeasureRef): boolean {
  if (r.kind === "speech") return r.key === "maxScore";
  if (r.kind === "noise") return r.key.endsWith("Score");
  return false;
}

function differs(r: MeasureRef, a: Measure, b: Measure): boolean {
  if (Boolean(a.noResponse) !== Boolean(b.noResponse)) return true;
  if (a.noResponse && b.noResponse) return false;
  if (a.value === null || b.value === null) return a.value !== b.value;
  return isPercent(r) ? a.value !== b.value : Math.abs(a.value - b.value) > CONFLICT_DB;
}

const candidate = (m: Measure, s: MergeSource): ConflictCandidate => ({
  attachmentId: s.id,
  fileName: s.fileName,
  value: m.value,
  ...(m.noResponse ? { noResponse: true } : {}),
  confidence: m.confidence,
});

const time = (d: string | Date) => (d instanceof Date ? d.getTime() : Date.parse(d));

/**
 * Fusionne les lectures des fichiers (triés par dépôt) puis superpose les valeurs
 * manuelles du fusionné précédent. Cellule déjà lue dans un autre fichier :
 * la confiance la plus haute l'emporte (égalité : le fichier le plus ancien) ; si les
 * deux lectures diffèrent (> 5 dB, ou ≠ en %), la valeur retenue passe en confiance
 * faible et le conflit est consigné pour la vérification.
 */
export function mergeExtractions(sources: MergeSource[], previous: Audiometry | null): MergeResult {
  const ordered = [...sources].sort((x, y) => time(x.createdAt) - time(y.createdAt) || x.id.localeCompare(y.id));
  const refs = allRefs();
  let merged = emptyAudiometry();
  const conflicts = new Map<string, Conflict>();
  const origin = new Map<string, MergeSource>();
  const notes: string[] = [];
  let testName: string | null = null;

  for (const src of ordered) {
    const a = remapCondition(src.audiometry, src.condition, src.aidedSheet);
    if (a.notes?.trim()) notes.push(`${src.fileName} : ${a.notes.trim()}`);
    if (!testName && a.noise?.testName) testName = a.noise.testName;
    for (const r of refs) {
      const m = getMeasure(a, r);
      if (!isPresent(m)) continue;
      const id = refId(r);
      const current = getMeasure(merged, r);
      if (!isPresent(current)) {
        merged = setMeasure(merged, r, { ...m, source: src.id });
        origin.set(id, src);
        continue;
      }
      const currentSrc = origin.get(id)!;
      const newWins = RANK[m.confidence] > RANK[current.confidence];
      const conflict = differs(r, current, m);
      if (!conflict) {
        if (newWins) {
          merged = setMeasure(merged, r, { ...m, source: src.id });
          origin.set(id, src);
        }
        continue;
      }
      const existing = conflicts.get(id);
      const keptSoFar: ConflictCandidate = existing?.kept ?? candidate(current, currentSrc);
      const others = existing?.others ?? [];
      if (newWins) {
        merged = setMeasure(merged, r, { ...m, source: src.id, confidence: "low" });
        origin.set(id, src);
        conflicts.set(id, { ref: r, kept: candidate(m, src), others: [...others, keptSoFar] });
      } else {
        merged = setMeasure(merged, r, { ...current, confidence: "low" });
        conflicts.set(id, { ref: r, kept: keptSoFar, others: [...others, candidate(m, src)] });
      }
    }
  }

  if (previous) {
    for (const r of refs) {
      const m = getMeasure(previous, r);
      if (!isPresent(m) || m.source) continue;
      merged = setMeasure(merged, r, m);
      conflicts.delete(refId(r));
    }
    if (previous.noise?.testName && !testName) testName = previous.noise.testName;
  }

  if (merged.noise) merged.noise.testName = testName;
  else if (testName) merged.noise = { testName, unaidedSnr: null, aidedSnr: null, unaidedScore: null, aidedScore: null };
  merged.notes = notes.length ? notes.join(" · ").slice(0, 1000) : null;
  return { audiometry: merged, conflicts: [...conflicts.values()] };
}

/** Le candidat choisi devient une valeur manuelle (confiance élevée, sans provenance) ; le conflit est levé. */
export function resolveConflict(result: MergeResult, ref: MeasureRef, attachmentId: string): MergeResult {
  const id = refId(ref);
  const conflict = result.conflicts.find((c) => refId(c.ref) === id);
  if (!conflict) return result;
  const chosen = [conflict.kept, ...conflict.others].find((c) => c.attachmentId === attachmentId);
  if (!chosen) return result;
  const m: Measure = { value: chosen.value, confidence: "high", ...(chosen.noResponse ? { noResponse: true } : {}) };
  return { audiometry: setMeasure(result.audiometry, ref, m), conflicts: result.conflicts.filter((c) => refId(c.ref) !== id) };
}

/** Nature d'un fichier d'après sa lecture (pour la puce de la liste des fichiers). */
export type BilanKind = "tonale" | "appareillee" | "vocale" | "bruit" | "mixte" | "vide";

export function bilanKind(a: Audiometry | null, condition: BilanCondition, aidedSheet: boolean): BilanKind {
  if (!a) return "vide";
  const r = remapCondition(a, condition, aidedSheet);
  const has = (c: Curve) => FREQ_KEYS.some((f) => isPresent(c[f]));
  const tonal = has(r.right.air) || has(r.left.air) || has(r.right.bone) || has(r.left.bone) || has(r.freeField.unaided);
  const aided = has(r.right.aided) || has(r.left.aided) || has(r.freeField.aided);
  const speech = [r.right.speech, r.left.speech, r.freeField.speechUnaided, r.freeField.speechAided].some((s) => SPEECH_KEYS.some((k) => isPresent(s[k])));
  const noise = Boolean(r.noise && NOISE_KEYS.some((k) => isPresent(r.noise![k])));
  const kinds = [tonal, aided, speech, noise].filter(Boolean).length;
  if (kinds === 0) return "vide";
  if (kinds > 1) return "mixte";
  return tonal ? "tonale" : aided ? "appareillee" : speech ? "vocale" : "bruit";
}
