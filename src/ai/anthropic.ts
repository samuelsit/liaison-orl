import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { COMMENT_PROMPT, COMMENT_STYLES, DICTATION_PROMPT, EXTRACTION_PROMPT, MOTIF_PROMPT } from "./prompts";
import { EXTRACTION_JSON_SCHEMA } from "./extraction-schema";
import { AiError, type AiFile, type AiProvider, type AiResult, type AiUsage, type CommentRequest } from "./types";

/** Modèles acceptant le repli serveur `fallbacks: "default"` (refus de sécurité). */
const FALLBACK_CAPABLE = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"];

const textSchema = (key: string) => ({
  type: "json_schema" as const,
  schema: { type: "object", additionalProperties: false, required: [key], properties: { [key]: { type: "string" } } },
});

function usageOf(model: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number | null; cache_creation_input_tokens: number | null }): AiUsage {
  return {
    model,
    mock: false,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

function mapError(err: unknown): never {
  if (err instanceof AiError) throw err;
  if (err instanceof Anthropic.RateLimitError) throw new AiError("Le service d'IA est saturé. Réessayez dans un instant.", "rate_limited");
  if (err instanceof Anthropic.BadRequestError && /too large|exceeds/i.test(err.message)) throw new AiError("Le fichier est trop volumineux pour être lu.", "too_large");
  if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
    console.error("Anthropic", err instanceof Anthropic.APIError ? err.status : "connexion", err.message);
    throw new AiError("Le service d'IA est momentanément indisponible.", "unavailable");
  }
  throw err;
}

function parseJson(text: string | undefined): unknown {
  if (!text) throw new AiError("Réponse vide du modèle.", "invalid_output");
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError("Réponse illisible du modèle.", "invalid_output");
  }
}

export class AnthropicProvider implements AiProvider {
  readonly mode = "live" as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  private geo() {
    const g = env().AI_INFERENCE_GEO;
    return g ? { inference_geo: g } : {};
  }

  async extract(file: AiFile): Promise<AiResult> {
    const model = env().AI_MODEL_VISION;
    const data = file.data.toString("base64");
    const source =
      file.mimeType === "application/pdf"
        ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
        : ({ type: "image", source: { type: "base64", media_type: file.mimeType, data } } as const);
    try {
      const res = await this.client.beta.messages.create({
        model,
        max_tokens: 16000,
        ...(FALLBACK_CAPABLE.includes(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        ...this.geo(),
        system: [{ type: "text", text: EXTRACTION_PROMPT.system, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown> } },
        messages: [{ role: "user", content: [source, { type: "text", text: EXTRACTION_PROMPT.user }] }],
      });
      if (res.stop_reason === "refusal") throw new AiError("Le modèle a refusé de traiter ce document.", "refusal");
      if (res.stop_reason === "max_tokens") throw new AiError("La réponse du modèle a été tronquée.", "invalid_output");
      const text = res.content.find((b) => b.type === "text");
      return { raw: parseJson(text?.type === "text" ? text.text : undefined), usage: usageOf(res.model, res.usage) };
    } catch (err) {
      mapError(err);
    }
  }

  private async text(system: string, user: string, key: string, maxTokens = 4000): Promise<AiResult> {
    const model = env().AI_MODEL_TEXT;
    try {
      const res = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        ...this.geo(),
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "low", format: textSchema(key) },
        messages: [{ role: "user", content: user }],
      });
      if (res.stop_reason === "refusal") throw new AiError("Le modèle a refusé la demande.", "refusal");
      const block = res.content.find((b) => b.type === "text");
      return { raw: parseJson(block?.type === "text" ? block.text : undefined), usage: usageOf(res.model, res.usage) };
    } catch (err) {
      mapError(err);
    }
  }

  writeComment(req: CommentRequest): Promise<AiResult> {
    const user = [
      `Ton souhaité par l'organisation : ${req.tone}.`,
      `Longueur : entre ${req.minLines} et ${req.maxLines} lignes d'environ 100 caractères. ${COMMENT_STYLES[req.style]}`,
      "Informations disponibles :",
      req.factsText,
      'Réponds avec le champ "comment" contenant uniquement le paragraphe.',
    ].join("\n");
    return this.text(COMMENT_PROMPT.system, user, "comment");
  }

  reformulateMotif(notes: string): Promise<AiResult> {
    return this.text(MOTIF_PROMPT.system, `Notes de l'audioprothésiste :\n"""${notes}"""\nRéponds avec le champ "motif".`, "motif", 1500);
  }

  async ping() {
    await this.client.models.retrieve(env().AI_MODEL_VISION);
    await this.client.models.retrieve(env().AI_MODEL_TEXT);
  }

  cleanDictation(text: string): Promise<AiResult> {
    return this.text(DICTATION_PROMPT.system, `Transcription :\n"""${text}"""\nRéponds avec le champ "text".`, "text", 3000);
  }
}
