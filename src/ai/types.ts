import type { CommentStyle } from "./prompts";

export interface AiUsage {
  model: string;
  mock: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AiFile {
  data: Buffer;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
}

/** Faits (déjà pseudonymisés) transmis pour la rédaction du commentaire. */
export interface CommentFacts {
  civility: "Mme" | "M." | null;
  age: number | null;
  ears: string | null;
  degree: string | null;
  deviceType: string | null;
  brand: string | null;
  model: string | null;
  deviceClass: string | null;
  rechargeable: boolean | null;
  customEarmolds: boolean | null;
  wearDuration: string | null;
  hoursPerDay: number | null;
  motivation: string | null;
  handling: string | null;
  ptaRight: number | null;
  ptaLeft: number | null;
  globalLoss: number | null;
  biapLabel: string | null;
  meanGain: number | null;
  srtUnaided: number | null;
  srtAided: number | null;
  srtGain: number | null;
  scoreUnaided: number | null;
  scoreAided: number | null;
  scoreGain: number | null;
  noiseTest: string | null;
  noiseSnrGain: number | null;
  noiseScoreGain: number | null;
  userNotes: string;
}

export interface CommentRequest {
  facts: CommentFacts;
  factsText: string;
  style: CommentStyle;
  tone: string;
  minLines: number;
  maxLines: number;
}

export interface AiResult {
  raw: unknown;
  usage: AiUsage;
}

export interface AiProvider {
  readonly mode: "live" | "mock";
  extract(file: AiFile): Promise<AiResult>;
  writeComment(req: CommentRequest): Promise<AiResult>;
  reformulateMotif(notes: string): Promise<AiResult>;
  cleanDictation(text: string): Promise<AiResult>;
  /** Vérifie l'accès aux modèles configurés (sans consommer de jetons). */
  ping(): Promise<void>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: "unavailable" | "refusal" | "invalid_output" | "rate_limited" | "too_large" | "not_audiogram",
  ) {
    super(message);
    this.name = "AiError";
  }
}
