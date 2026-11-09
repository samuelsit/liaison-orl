import { z } from "zod";

/** Fréquences audiométriques prises en charge (Hz). */
export const FREQUENCIES = [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FREQ_KEYS = FREQUENCIES.map(String) as unknown as readonly [
  "125", "250", "500", "750", "1000", "1500", "2000", "3000", "4000", "6000", "8000",
];
export type FreqKey = (typeof FREQ_KEYS)[number];
export const freqKeySchema = z.enum(FREQ_KEYS);

/** Fréquences affichées par défaut dans le tableau de correction. */
export const MAIN_FREQUENCIES: readonly Frequency[] = [125, 250, 500, 1000, 2000, 3000, 4000, 6000, 8000];

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const measureSchema = z.object({
  value: z.number().min(-20).max(140).nullable(),
  confidence: confidenceSchema,
  /** Absence de réponse au niveau maximal de l'audiomètre. */
  noResponse: z.boolean().optional(),
  /**
   * Provenance : identifiant de la pièce jointe dont la valeur a été lue (posé par la
   * fusion de plusieurs bilans). Absent = valeur saisie ou choisie à la main, jamais écrasée.
   */
  source: z.string().max(64).optional(),
});
export type Measure = z.infer<typeof measureSchema>;

export const curveSchema = z.partialRecord(freqKeySchema, measureSchema);
export type Curve = z.infer<typeof curveSchema>;

export const speechSchema = z.object({
  /** Seuil d'intelligibilité (dB) — niveau donnant 50 % d'intelligibilité. */
  srt: measureSchema.nullable().default(null),
  /** Meilleur score d'intelligibilité (%). */
  maxScore: measureSchema.nullable().default(null),
  /** Niveau de présentation du meilleur score (dB). */
  maxScoreLevel: measureSchema.nullable().default(null),
});
export type Speech = z.infer<typeof speechSchema>;

export const earSchema = z.object({
  air: curveSchema.default({}),
  bone: curveSchema.default({}),
  /** Seuils en champ libre avec appareil, cette oreille seule (gain prothétique par oreille). */
  aided: curveSchema.default({}),
  speech: speechSchema.default({ srt: null, maxScore: null, maxScoreLevel: null }),
});
export type EarAudiometry = z.infer<typeof earSchema>;

export const noiseTestSchema = z.object({
  testName: z.string().max(80).nullable().default(null),
  /** Rapport signal/bruit pour 50 % d'intelligibilité (dB), sans et avec appareils. */
  unaidedSnr: measureSchema.nullable().default(null),
  aidedSnr: measureSchema.nullable().default(null),
  /** Score (%) dans le bruit, sans et avec appareils. */
  unaidedScore: measureSchema.nullable().default(null),
  aidedScore: measureSchema.nullable().default(null),
});
export type NoiseTest = z.infer<typeof noiseTestSchema>;

export const freeFieldSchema = z.object({
  unaided: curveSchema.default({}),
  aided: curveSchema.default({}),
  speechUnaided: speechSchema.default({ srt: null, maxScore: null, maxScoreLevel: null }),
  speechAided: speechSchema.default({ srt: null, maxScore: null, maxScoreLevel: null }),
});
export type FreeField = z.infer<typeof freeFieldSchema>;

export const audiometrySchema = z.object({
  version: z.literal(1).default(1),
  right: earSchema,
  left: earSchema,
  freeField: freeFieldSchema,
  noise: noiseTestSchema.nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
});
export type Audiometry = z.infer<typeof audiometrySchema>;

/* ---------- Références de mesure (chemins stables, partagés client / serveur) ---------- */

export const CURVE_PATHS = ["right.air", "right.bone", "right.aided", "left.air", "left.bone", "left.aided", "freeField.unaided", "freeField.aided"] as const;
export const curvePathSchema = z.enum(CURVE_PATHS);
export type CurvePath = z.infer<typeof curvePathSchema>;

export const SPEECH_TARGETS = ["right", "left", "speechUnaided", "speechAided"] as const;
export const speechTargetSchema = z.enum(SPEECH_TARGETS);
export type SpeechTarget = z.infer<typeof speechTargetSchema>;

export const SPEECH_KEYS = ["srt", "maxScore", "maxScoreLevel"] as const satisfies readonly (keyof Speech)[];
export const speechKeySchema = z.enum(SPEECH_KEYS);
export type SpeechKey = z.infer<typeof speechKeySchema>;

export const NOISE_KEYS = ["unaidedSnr", "aidedSnr", "unaidedScore", "aidedScore"] as const;
export const noiseKeySchema = z.enum(NOISE_KEYS);
export type NoiseKey = z.infer<typeof noiseKeySchema>;

export const measureRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("curve"), path: curvePathSchema, freq: freqKeySchema }),
  z.object({ kind: z.literal("speech"), target: speechTargetSchema, key: speechKeySchema }),
  z.object({ kind: z.literal("noise"), key: noiseKeySchema }),
]);
export type MeasureRef = z.infer<typeof measureRefSchema>;

/* ---------- Fusion de plusieurs bilans ---------- */

/** Interprétation d'un fichier : automatique (selon la lecture), tout sans appareil, tout avec appareils. */
export const BILAN_CONDITIONS = ["auto", "unaided", "aided"] as const;
export const bilanConditionSchema = z.enum(BILAN_CONDITIONS);
export type BilanCondition = z.infer<typeof bilanConditionSchema>;

export const conflictCandidateSchema = z.object({
  attachmentId: z.string(),
  fileName: z.string(),
  value: z.number().nullable(),
  noResponse: z.boolean().optional(),
  confidence: confidenceSchema,
});
export type ConflictCandidate = z.infer<typeof conflictCandidateSchema>;

/** Même mesure lue différemment dans plusieurs fichiers : valeur retenue et autres lectures. */
export const conflictSchema = z.object({
  ref: measureRefSchema,
  kept: conflictCandidateSchema,
  others: z.array(conflictCandidateSchema).min(1),
});
export type Conflict = z.infer<typeof conflictSchema>;

export function emptyAudiometry(): Audiometry {
  const speech = { srt: null, maxScore: null, maxScoreLevel: null };
  return {
    version: 1,
    right: { air: {}, bone: {}, aided: {}, speech: { ...speech } },
    left: { air: {}, bone: {}, aided: {}, speech: { ...speech } },
    freeField: { unaided: {}, aided: {}, speechUnaided: { ...speech }, speechAided: { ...speech } },
    noise: null,
    notes: null,
  };
}
