import { z } from "zod";
import { FREQUENCIES, emptyAudiometry, type Audiometry, type Curve, type FreqKey, type Measure, type Speech } from "@/lib/schemas/audiometry";

/*
 * Sortie structurée imposée au modèle. Schéma volontairement « à plat », sans type
 * nullable ni union (limite des sorties structurées) : une mesure illisible est
 * simplement absente des listes, ce qui vaut « non détecté ».
 */

const CURVES = ["right_air", "right_bone", "left_air", "left_bone", "free_field_unaided", "free_field_aided"] as const;
const SPEECH_CONDITIONS = ["right", "left", "free_field_unaided", "free_field_aided"] as const;
const SPEECH_MEASURES = ["srt_db", "max_score_percent", "max_score_level_db"] as const;
const NOISE_MEASURES = ["unaided_snr_db", "aided_snr_db", "unaided_score_percent", "aided_score_percent"] as const;
const CONFIDENCES = ["high", "medium", "low"] as const;

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_audiogram", "thresholds", "speech", "noise_test_name", "noise", "notes"],
  properties: {
    is_audiogram: { type: "boolean" },
    thresholds: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["curve", "frequency_hz", "threshold_db", "no_response", "confidence"],
        properties: {
          curve: { type: "string", enum: [...CURVES] },
          frequency_hz: { type: "integer", enum: [...FREQUENCIES] },
          threshold_db: { type: "number" },
          no_response: { type: "boolean" },
          confidence: { type: "string", enum: [...CONFIDENCES] },
        },
      },
    },
    speech: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["condition", "measure", "value", "confidence"],
        properties: {
          condition: { type: "string", enum: [...SPEECH_CONDITIONS] },
          measure: { type: "string", enum: [...SPEECH_MEASURES] },
          value: { type: "number" },
          confidence: { type: "string", enum: [...CONFIDENCES] },
        },
      },
    },
    noise_test_name: { type: "string" },
    noise: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["measure", "value", "confidence"],
        properties: {
          measure: { type: "string", enum: [...NOISE_MEASURES] },
          value: { type: "number" },
          confidence: { type: "string", enum: [...CONFIDENCES] },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

/* ---------- Validation Zod de la réponse brute ---------- */

const zConf = z.enum(CONFIDENCES);
export const rawExtractionSchema = z.object({
  is_audiogram: z.boolean(),
  thresholds: z
    .array(
      z.object({
        curve: z.enum(CURVES),
        frequency_hz: z.number().int(),
        threshold_db: z.number(),
        no_response: z.boolean(),
        confidence: zConf,
      }),
    )
    .max(200),
  speech: z.array(z.object({ condition: z.enum(SPEECH_CONDITIONS), measure: z.enum(SPEECH_MEASURES), value: z.number(), confidence: zConf })).max(40),
  noise_test_name: z.string().max(200),
  noise: z.array(z.object({ measure: z.enum(NOISE_MEASURES), value: z.number(), confidence: zConf })).max(10),
  notes: z.string().max(2000),
});
export type RawExtraction = z.infer<typeof rawExtractionSchema>;

const FREQ_SET = new Set<number>(FREQUENCIES);
const CURVE_PATH: Record<(typeof CURVES)[number], [keyof Audiometry, string]> = {
  right_air: ["right", "air"],
  right_bone: ["right", "bone"],
  left_air: ["left", "air"],
  left_bone: ["left", "bone"],
  free_field_unaided: ["freeField", "unaided"],
  free_field_aided: ["freeField", "aided"],
};
const SPEECH_KEY: Record<(typeof SPEECH_MEASURES)[number], keyof Speech> = { srt_db: "srt", max_score_percent: "maxScore", max_score_level_db: "maxScoreLevel" };

function bounded(value: number, confidence: Measure["confidence"], min: number, max: number): Measure {
  if (value < min || value > max) return { value: null, confidence: "low" };
  return { value: Math.round(value * 10) / 10, confidence };
}

/** Convertit la sortie du modèle en mesures de l'application (valeurs hors limites → non détecté). */
export function toAudiometry(raw: RawExtraction): Audiometry {
  const a = emptyAudiometry();
  if (!raw.is_audiogram) return { ...a, notes: "Le document ne semble pas être un bilan auditif." };
  for (const t of raw.thresholds) {
    if (!FREQ_SET.has(t.frequency_hz)) continue;
    const [k1, k2] = CURVE_PATH[t.curve];
    const curve = (a[k1] as unknown as Record<string, Curve>)[k2]!;
    const m = t.no_response ? { ...bounded(t.threshold_db, t.confidence, -20, 140), noResponse: true } : bounded(t.threshold_db, t.confidence, -20, 140);
    curve[String(t.frequency_hz) as FreqKey] = m;
  }
  for (const s of raw.speech) {
    const target: Speech =
      s.condition === "right" ? a.right.speech : s.condition === "left" ? a.left.speech : s.condition === "free_field_unaided" ? a.freeField.speechUnaided : a.freeField.speechAided;
    target[SPEECH_KEY[s.measure]] = s.measure === "max_score_percent" ? bounded(s.value, s.confidence, 0, 100) : bounded(s.value, s.confidence, -20, 130);
  }
  if (raw.noise.length || raw.noise_test_name.trim()) {
    a.noise = { testName: raw.noise_test_name.trim().slice(0, 80) || null, unaidedSnr: null, aidedSnr: null, unaidedScore: null, aidedScore: null };
    for (const n of raw.noise) {
      if (n.measure === "unaided_snr_db") a.noise.unaidedSnr = bounded(n.value, n.confidence, -30, 40);
      if (n.measure === "aided_snr_db") a.noise.aidedSnr = bounded(n.value, n.confidence, -30, 40);
      if (n.measure === "unaided_score_percent") a.noise.unaidedScore = bounded(n.value, n.confidence, 0, 100);
      if (n.measure === "aided_score_percent") a.noise.aidedScore = bounded(n.value, n.confidence, 0, 100);
    }
  }
  a.notes = raw.notes.trim().slice(0, 1000) || null;
  return a;
}

/** Inverse (bilans fictifs de démonstration et tests). */
export function fromAudiometry(a: Audiometry): RawExtraction {
  const thresholds: RawExtraction["thresholds"] = [];
  for (const [curve, [k1, k2]] of Object.entries(CURVE_PATH) as [(typeof CURVES)[number], [keyof Audiometry, string]][]) {
    const c = (a[k1] as unknown as Record<string, Curve>)[k2]!;
    for (const [f, m] of Object.entries(c)) {
      if (!m || (m.value === null && !m.noResponse)) continue;
      thresholds.push({ curve, frequency_hz: Number(f), threshold_db: m.value ?? 120, no_response: Boolean(m.noResponse), confidence: m.confidence });
    }
  }
  const speech: RawExtraction["speech"] = [];
  const pushSpeech = (condition: (typeof SPEECH_CONDITIONS)[number], s: Speech) => {
    for (const [measure, key] of Object.entries(SPEECH_KEY) as [(typeof SPEECH_MEASURES)[number], keyof Speech][]) {
      const m = s[key];
      if (m && m.value !== null) speech.push({ condition, measure, value: m.value, confidence: m.confidence });
    }
  };
  pushSpeech("right", a.right.speech);
  pushSpeech("left", a.left.speech);
  pushSpeech("free_field_unaided", a.freeField.speechUnaided);
  pushSpeech("free_field_aided", a.freeField.speechAided);
  const noise: RawExtraction["noise"] = [];
  if (a.noise) {
    const add = (measure: (typeof NOISE_MEASURES)[number], m: Measure | null) => m && m.value !== null && noise.push({ measure, value: m.value, confidence: m.confidence });
    add("unaided_snr_db", a.noise.unaidedSnr);
    add("aided_snr_db", a.noise.aidedSnr);
    add("unaided_score_percent", a.noise.unaidedScore);
    add("aided_score_percent", a.noise.aidedScore);
  }
  return { is_audiogram: true, thresholds, speech, noise_test_name: a.noise?.testName ?? "", noise, notes: a.notes ?? "" };
}
