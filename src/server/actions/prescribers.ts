"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { parsePrescriberRows } from "@/lib/prescribers/csv";
import {
  createPrescriber,
  importPrescribers,
  listPrescribers,
  mergePrescribers,
  setPrescriberArchived,
  suggestPrescribers,
  toggleFavorite,
  updatePrescriber,
  type ImportReport,
  type PrescriberFilter,
  type PrescriberView,
} from "@/server/services/prescribers";
import { runAction, type ActionResult } from "./result";

export async function suggestPrescribersAction(query: string): Promise<PrescriberView[]> {
  const ctx = await getUserContextOrThrow();
  return suggestPrescribers(ctx, String(query).slice(0, 80));
}

export async function listPrescribersAction(opts: { q?: string; filter?: PrescriberFilter; offset?: number }) {
  const ctx = await getUserContextOrThrow();
  return listPrescribers(ctx, { q: opts.q?.slice(0, 80), filter: opts.filter, offset: opts.offset, limit: 50 });
}

export async function createPrescriberAction(
  input: unknown,
  force = false,
): Promise<ActionResult<{ created: PrescriberView | null; similar: PrescriberView[] }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await createPrescriber(ctx, input, { force });
    if (res.created) revalidatePath("/prescripteurs");
    return res;
  });
}

export async function updatePrescriberAction(id: string, input: unknown): Promise<ActionResult<PrescriberView>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await updatePrescriber(ctx, z.string().parse(id), input);
    revalidatePath("/prescripteurs");
    revalidatePath(`/prescripteurs/${id}`);
    return res;
  }, "Fiche enregistrée.");
}

export async function toggleFavoriteAction(id: string): Promise<ActionResult<{ favorite: boolean }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const favorite = await toggleFavorite(ctx, z.string().parse(id));
    revalidatePath("/prescripteurs");
    return { favorite };
  });
}

export async function setPrescriberArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    await setPrescriberArchived(ctx, z.string().parse(id), archived);
    revalidatePath("/prescripteurs");
    return undefined;
  });
}

const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).max(5000),
  updateExisting: z.boolean(),
});

export async function importPrescribersAction(input: unknown): Promise<ActionResult<ImportReport>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const { rows, updateExisting } = importSchema.parse(input);
    const parsed = parsePrescriberRows(rows);
    const valid = parsed.flatMap((r) => (r.ok && r.value ? [{ row: r.row, value: r.value }] : []));
    const report = await importPrescribers(ctx, valid, { updateExisting });
    report.errors.push(...parsed.filter((r) => !r.ok).map((r) => ({ row: r.row, error: r.error ?? "Ligne invalide" })));
    revalidatePath("/prescripteurs");
    return report;
  });
}

export async function mergePrescribersAction(masterId: string, otherIds: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    await mergePrescribers(ctx, z.string().parse(masterId), z.array(z.string()).parse(otherIds));
    revalidatePath("/prescripteurs");
    revalidatePath("/admin/annuaire");
    return undefined;
  }, "Fiches fusionnées.");
}

export async function getPrescriberViewAction(id: string): Promise<PrescriberView | null> {
  const ctx = await getUserContextOrThrow();
  const { getPrescriber, toPrescriberView } = await import("@/server/services/prescribers");
  try {
    return toPrescriberView(await getPrescriber(ctx, z.string().parse(id)), ctx.user.id);
  } catch {
    return null;
  }
}
