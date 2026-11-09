"use server";

import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { suggestDegree } from "@/lib/audiology/calculations";
import type { AttachmentView } from "@/lib/schemas/attachment";
import type { BilanView } from "@/lib/schemas/document";
import { cleanDictation, extractBilan, generateComment, reformulateMotif } from "@/server/services/ai";
import { deleteAttachment, rebuildBilan, saveBilan, setAttachmentCondition, toAttachmentView, toBilanView } from "@/server/services/attachments";
import { runAction, type ActionResult } from "./result";

/** Lecture d'un fichier par l'IA ; ne recalcule pas la fusion (voir `rebuildBilanAction`). */
export async function extractBilanAction(attachmentId: string): Promise<ActionResult<AttachmentView>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    return toAttachmentView(await extractBilan(ctx, z.string().parse(attachmentId)));
  });
}

/** Recalcule le bilan fusionné du document à partir de tous ses fichiers (après un ou plusieurs dépôts). */
export async function rebuildBilanAction(documentId: string): Promise<ActionResult<BilanView>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    return toBilanView(await rebuildBilan(ctx, z.string().parse(documentId)))!;
  });
}

export interface ConfirmResult {
  bilan: BilanView;
  suggestion: { degree: ReturnType<typeof suggestDegree>["degree"]; ears: ReturnType<typeof suggestDegree>["ears"]; rule: string } | null;
}

/** Corrections du bilan fusionné ; `confirm` le valide et renvoie le degré et les oreilles suggérés. */
export async function saveBilanAction(documentId: string, audiometry: unknown, confirm: boolean): Promise<ActionResult<ConfirmResult>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const bilan = toBilanView(await saveBilan(ctx, z.string().parse(documentId), audiometry, confirm))!;
    const s = confirm && bilan.audiometry ? suggestDegree(bilan.audiometry) : null;
    return { bilan, suggestion: s ? { degree: s.degree, ears: s.ears, rule: s.rule } : null };
  });
}

export async function setAttachmentConditionAction(attachmentId: string, condition: unknown): Promise<ActionResult<{ attachment: AttachmentView; bilan: BilanView }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const r = await setAttachmentCondition(ctx, z.string().parse(attachmentId), condition);
    return { attachment: toAttachmentView(r.attachment), bilan: toBilanView(r.bilan)! };
  });
}

export async function deleteAttachmentAction(attachmentId: string): Promise<ActionResult<BilanView>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    return toBilanView(await deleteAttachment(ctx, z.string().parse(attachmentId)))!;
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
