"use server";

import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { suggestDegree } from "@/lib/audiology/calculations";
import type { Audiometry } from "@/lib/schemas/audiometry";
import { cleanDictation, extractBilan, generateComment, reformulateMotif } from "@/server/services/ai";
import { deleteAttachment, saveExtraction, toAttachmentView, type AttachmentView } from "@/server/services/attachments";
import { runAction, type ActionResult } from "./result";

export async function extractBilanAction(attachmentId: string): Promise<ActionResult<Audiometry>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    return extractBilan(ctx, z.string().parse(attachmentId));
  });
}

export interface ConfirmResult {
  attachment: AttachmentView;
  suggestion: { degree: ReturnType<typeof suggestDegree>["degree"]; ears: ReturnType<typeof suggestDegree>["ears"]; rule: string } | null;
}

export async function saveExtractionAction(attachmentId: string, audiometry: unknown, confirm: boolean): Promise<ActionResult<ConfirmResult>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const att = await saveExtraction(ctx, z.string().parse(attachmentId), audiometry, confirm);
    const view = toAttachmentView(att);
    const s = confirm && view.extraction ? suggestDegree(view.extraction) : null;
    return { attachment: view, suggestion: s ? { degree: s.degree, ears: s.ears, rule: s.rule } : null };
  });
}

export async function deleteAttachmentAction(attachmentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    await deleteAttachment(ctx, z.string().parse(attachmentId));
    return undefined;
  });
}

const refs = { patientId: z.string().nullable(), prescriberId: z.string().nullable() };

export async function generateCommentAction(documentId: string, input: unknown): Promise<ActionResult<{ comment: string }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const parsed = z.object({ data: z.unknown(), style: z.enum(["standard", "court", "detaille", "technique"]), ...refs }).parse(input);
    return { comment: await generateComment(ctx, z.string().parse(documentId), parsed) };
  });
}

export async function reformulateMotifAction(documentId: string, input: unknown): Promise<ActionResult<{ motif: string }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const parsed = z.object({ notes: z.string().max(1000), ...refs }).parse(input);
    return { motif: await reformulateMotif(ctx, z.string().parse(documentId), parsed) };
  });
}

export async function cleanDictationAction(documentId: string, input: unknown): Promise<ActionResult<{ text: string }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const parsed = z.object({ text: z.string().max(4000), ...refs }).parse(input);
    return { text: await cleanDictation(ctx, z.string().parse(documentId), parsed) };
  });
}
