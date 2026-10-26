"use server";

import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { documentTypeSchema } from "@/lib/schemas/document";
import { revalidatePath } from "next/cache";
import { createDocument, deleteDocument, reopenDocument, saveDraft, validateDocument } from "@/server/services/documents";
import { runAction, type ActionResult } from "./result";

const createOptsSchema = z.object({ patientId: z.string().max(64).nullish(), prescriberId: z.string().max(64).nullish() });

export async function createDocumentAction(
  type: string,
  opts: { patientId?: string | null; prescriberId?: string | null } = {},
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const doc = await createDocument(ctx, documentTypeSchema.parse(type), createOptsSchema.parse(opts));
    return { id: doc._id };
  });
}

const draftSchema = z.object({
  data: z.unknown(),
  patientId: z.string().nullable(),
  prescriberId: z.string().nullable(),
  aiFields: z.array(z.string().max(80)).max(50),
});

export async function saveDraftAction(id: string, patch: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await saveDraft(ctx, z.string().parse(id), draftSchema.parse(patch));
    return { updatedAt: res.updatedAt.toISOString() };
  });
}

export async function validateDocumentAction(
  id: string,
): Promise<ActionResult<{ version: number; warnings: string[] } | { errors: Record<string, string>; warnings: string[] }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await validateDocument(ctx, z.string().parse(id));
    revalidatePath(`/documents/${id}`);
    revalidatePath("/");
    return res.ok ? { version: res.version, warnings: res.warnings } : { errors: res.errors, warnings: res.warnings };
  });
}

export async function reopenDocumentAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    await reopenDocument(ctx, z.string().parse(id));
    revalidatePath(`/documents/${id}`);
    return undefined;
  });
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    await deleteDocument(ctx, z.string().parse(id));
    revalidatePath("/documents");
    revalidatePath("/");
    return undefined;
  });
}
