import { env } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { MockAiProvider } from "./mock";
import type { AiProvider } from "./types";

let instance: AiProvider | null = null;

/** Fournisseur d'IA : Anthropic si la clé est présente, sinon simulation réaliste (mode démo). */
export function aiProvider(): AiProvider {
  if (instance) return instance;
  const key = env().ANTHROPIC_API_KEY;
  instance = key ? new AnthropicProvider(key) : new MockAiProvider();
  return instance;
}

export function setAiProvider(p: AiProvider | null) {
  instance = p;
}

/** Tarifs indicatifs (USD par million de jetons) pour l'estimation des coûts. */
export const AI_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** Coût estimé en micro-dollars (1 $ / Mjetons = 1 µ$ / jeton). */
export function estimateCostMicroUsd(model: string, u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): number {
  const p = AI_PRICES[model] ?? AI_PRICES[Object.keys(AI_PRICES).find((k) => model.startsWith(k)) ?? ""];
  if (!p) return 0;
  return Math.round(u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite);
}

export type { AiProvider } from "./types";
