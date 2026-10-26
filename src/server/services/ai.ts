import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { aiProvider, estimateCostMicroUsd } from "@/ai";
import { readDemoMarker } from "@/ai/mock";
import { buildCommentFacts, factsToText } from "@/ai/facts";
import { rawExtractionSchema, toAudiometry } from "@/ai/extraction-schema";
import { buildEntities, pseudonymize, reidentify, containsIdentity } from "@/ai/pseudonymize";
import type { CommentStyle } from "@/ai/prompts";
import { AiError, type AiFile, type AiResult } from "@/ai/types";
import { collections } from "@/lib/db/collections";
import type { AiKind } from "@/lib/db/types";
import type { UserContext } from "@/lib/auth/session";
import { assertCentre } from "@/lib/auth/permissions";
import { audiometrySchema, type Audiometry } from "@/lib/schemas/audiometry";
import { compteRenduDataSchema } from "@/lib/schemas/document";
import { countMeasures } from "@/lib/audiology/calculations";
import { UserFacingError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { hit } from "@/server/rate-limit";
import { actor, getDocumentForUser } from "./documents";
import { getAttachmentForUser } from "./attachments";
import { storage } from "./storage";

async function guard(ctx: UserContext) {
  if (!ctx.organization.settings.ai.enabled) throw new UserFacingError("L'assistance IA est désactivée par votre administrateur.");
  if (!(await hit(`ai:${ctx.user.id}`, 40, 60))) throw new UserFacingError("Trop de demandes à l'IA en une minute. Patientez un instant.");
}

async function record(ctx: UserContext, kind: AiKind, result: AiResult | null, success: boolean, model?: string) {
  const u = result?.usage;
  await collections()
    .aiUsage()
    .insertOne({
      _id: randomUUID(),
      organizationId: ctx.user.organizationId,
      centreId: ctx.activeCentre._id,
      userId: ctx.user.id,
      kind,
      model: u?.model ?? model ?? "inconnu",
      mock: u?.mock ?? aiProvider().mode === "mock",
      inputTokens: u?.inputTokens ?? 0,
      outputTokens: u?.outputTokens ?? 0,
      cacheReadTokens: u?.cacheReadTokens ?? 0,
      cacheWriteTokens: u?.cacheWriteTokens ?? 0,
      costMicroUsd: u && !u.mock ? estimateCostMicroUsd(u.model, u) : 0,
      success,
      at: new Date(),
    });
}

/**
 * Appel au modèle avec validation Zod de la sortie : une seconde tentative en cas de
 * sortie invalide, puis erreur explicite (bascule en saisie manuelle côté interface).
 */
async function callValidated<T>(ctx: UserContext, kind: AiKind, call: () => Promise<AiResult>, schema: z.ZodType<T>): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: AiResult | null = null;
    try {
      result = await call();
      const parsed = schema.safeParse(result.raw);
      await record(ctx, kind, result, parsed.success);
      if (parsed.success) return parsed.data;
      lastError = new AiError("Réponse du modèle non conforme.", "invalid_output");
    } catch (err) {
      if (!result) await record(ctx, kind, null, false);
      if (err instanceof AiError && err.code !== "invalid_output") throw err;
      lastError = err;
    }
  }
  throw lastError instanceof AiError ? lastError : new AiError("Réponse du modèle non conforme.", "invalid_output");
}

/** Prépare le fichier pour la vision : images redimensionnées (≤ 1 568 px) et compressées. */
export async function prepareForVision(data: Buffer, mimeType: string): Promise<AiFile> {
  if (mimeType === "application/pdf") return { data, mimeType: "application/pdf" };
  let img = sharp(data).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true });
  // Les bilans fictifs de démonstration gardent leur marqueur (lu par le mode démo).
  if (readDemoMarker(data)) img = img.keepExif();
  const out = await img.jpeg({ quality: 85 }).toBuffer();
  return { data: out, mimeType: "image/jpeg" };
}

export async function extractBilan(ctx: UserContext, attachmentId: string): Promise<Audiometry> {
  await guard(ctx);
  const att = await getAttachmentForUser(ctx, attachmentId);
  const file = await storage().get(att.fileKey);
  if (!file) throw new UserFacingError("Fichier introuvable : déposez à nouveau le bilan.");
  const input = await prepareForVision(file, att.mimeType);
  try {
    const raw = await callValidated(ctx, "extraction", () => aiProvider().extract(input), rawExtractionSchema);
    const audiometry = toAudiometry(raw);
    if (!raw.is_audiogram || countMeasures(audiometry) === 0) {
      throw new AiError("Aucune mesure audiométrique n'a été trouvée dans ce document.", "not_audiogram");
    }
    await collections()
      .attachments()
      .updateOne({ _id: att._id }, { $set: { extraction: audiometry, extractionStatus: "done", extractionError: null, updatedAt: new Date() } });
    await audit(actor(ctx), "attachment.extract", "attachment", att._id, { measures: countMeasures(audiometry) });
    return audiometry;
  } catch (err) {
    const message = err instanceof AiError ? err.message : "La lecture automatique a échoué.";
    await collections()
      .attachments()
      .updateOne({ _id: att._id }, { $set: { extractionStatus: "failed", extractionError: message, updatedAt: new Date() } });
    throw new UserFacingError(`${message} Vous pouvez saisir les valeurs manuellement.`);
  }
}

const commentSchema = z.object({ comment: z.string().trim().min(20).max(2500) });
const motifSchema = z.object({ motif: z.string().trim().min(5).max(600) });
const dictationSchema = z.object({ text: z.string().trim().min(1).max(4000) });

async function entitiesFor(ctx: UserContext, patientId: string | null, prescriberId: string | null) {
  const [patient, prescriber] = await Promise.all([
    patientId ? collections().patients().findOne({ _id: patientId, organizationId: ctx.user.organizationId }) : null,
    prescriberId ? collections().prescribers().findOne({ _id: prescriberId, organizationId: ctx.user.organizationId }) : null,
  ]);
  if (patient) assertCentre(ctx.user, patient.centreId);
  return { patient, prescriber, entities: buildEntities({ patient, prescriber }) };
}

/** Rédaction du commentaire à partir des faits calculés en code (aucune identité transmise). */
export async function generateComment(
  ctx: UserContext,
  documentId: string,
  input: { data: unknown; patientId: string | null; prescriberId: string | null; style: CommentStyle },
): Promise<string> {
  await guard(ctx);
  const doc = await getDocumentForUser(ctx, documentId);
  if (doc.type !== "COMPTE_RENDU") throw new UserFacingError("Document incompatible.");
  const data = compteRenduDataSchema.parse(input.data);
  const { patient, entities } = await entitiesFor(ctx, input.patientId, input.prescriberId);
  let audiometry: Audiometry | null = null;
  if (data.attachmentId) {
    const att = await collections().attachments().findOne({ _id: data.attachmentId, documentId: doc._id, confirmed: true });
    const parsed = att?.extraction ? audiometrySchema.safeParse(att.extraction) : null;
    audiometry = parsed?.success ? parsed.data : null;
  }
  const notes = pseudonymize(data.comments, entities);
  const facts = buildCommentFacts(data, audiometry, patient ? { civility: patient.civility, birthDate: patient.birthDate } : null, notes);
  const factsText = factsToText(facts);
  if (containsIdentity(factsText, entities)) throw new UserFacingError("Données d'identité détectées dans le texte : envoi à l'IA bloqué.");
  const s = ctx.organization.settings.ai;
  const out = await callValidated(
    ctx,
    "comment",
    () => aiProvider().writeComment({ facts, factsText, style: input.style, tone: s.tone, minLines: s.commentMinLines, maxLines: s.commentMaxLines }),
    commentSchema,
  );
  await audit(actor(ctx), "ai.generate", "document", doc._id, { kind: "comment", style: input.style });
  return reidentify(out.comment, entities);
}

export async function reformulateMotif(ctx: UserContext, documentId: string, input: { notes: string; patientId: string | null; prescriberId: string | null }): Promise<string> {
  await guard(ctx);
  const doc = await getDocumentForUser(ctx, documentId);
  const { entities } = await entitiesFor(ctx, input.patientId, input.prescriberId);
  const notes = pseudonymize(input.notes.slice(0, 1000), entities);
  if (!notes.trim()) throw new UserFacingError("Saisissez ou dictez d'abord quelques mots.");
  const out = await callValidated(ctx, "motif", () => aiProvider().reformulateMotif(notes), motifSchema);
  await audit(actor(ctx), "ai.generate", "document", doc._id, { kind: "motif" });
  return reidentify(out.motif, entities);
}

export async function cleanDictation(ctx: UserContext, documentId: string, input: { text: string; patientId: string | null; prescriberId: string | null }): Promise<string> {
  await guard(ctx);
  await getDocumentForUser(ctx, documentId);
  const { entities } = await entitiesFor(ctx, input.patientId, input.prescriberId);
  const text = pseudonymize(input.text.slice(0, 4000), entities);
  const out = await callValidated(ctx, "dictation", () => aiProvider().cleanDictation(text), dictationSchema);
  return reidentify(out.text, entities);
}
