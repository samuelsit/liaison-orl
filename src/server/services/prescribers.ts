import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import { collections } from "@/lib/db/collections";
import type { PrescriberDoc } from "@/lib/db/types";
import { assertCan } from "@/lib/auth/permissions";
import type { UserContext } from "@/lib/auth/session";
import { prescriberInputSchema, type PrescriberInput } from "@/lib/schemas/prescriber";
import { prescriberSearchText } from "@/lib/search-text";
import { prefixWordsRegex } from "@/lib/text";
import { dedupeKeys, findDuplicateGroups, mergeFields } from "@/lib/prescribers/dedupe";
import { UserFacingError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { actor } from "./documents";

export interface PrescriberView {
  id: string;
  civility: PrescriberInput["civility"];
  firstName: string;
  lastName: string;
  specialty: string;
  rpps: string;
  practiceName: string;
  address: PrescriberInput["address"];
  email: string;
  phone: string;
  preferredChannel: PrescriberInput["preferredChannel"];
  salutation: string;
  notes: string;
  centreIds: string[];
  archived: boolean;
  isFavorite: boolean;
  isRecent?: boolean;
  updatedAt: string;
}

export function toPrescriberView(p: PrescriberDoc, userId: string, recentIds: Set<string> = new Set()): PrescriberView {
  return {
    id: p._id,
    civility: p.civility,
    firstName: p.firstName,
    lastName: p.lastName,
    specialty: p.specialty,
    rpps: p.rpps,
    practiceName: p.practiceName,
    address: p.address,
    email: p.email ?? "",
    phone: p.phone,
    preferredChannel: p.preferredChannel,
    salutation: p.salutation,
    notes: p.notes,
    centreIds: p.centreIds,
    archived: p.archived,
    isFavorite: p.favoriteOf.includes(userId),
    isRecent: recentIds.has(p._id),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type PrescriberFilter = "all" | "favorites" | "centre" | "archived";

export async function listPrescribers(
  ctx: UserContext,
  opts: { q?: string; filter?: PrescriberFilter; specialty?: string; limit?: number; offset?: number },
): Promise<{ items: PrescriberView[]; total: number }> {
  const q: Filter<PrescriberDoc> = { organizationId: ctx.user.organizationId, archived: opts.filter === "archived" };
  if (opts.filter === "favorites") q.favoriteOf = ctx.user.id;
  if (opts.filter === "centre") q.centreIds = ctx.activeCentre._id;
  if (opts.specialty) q.specialty = opts.specialty;
  const regex = opts.q ? prefixWordsRegex(opts.q) : null;
  if (regex) q.searchText = regex;
  const [docs, total] = await Promise.all([
    collections()
      .prescribers()
      .find(q)
      .sort({ lastName: 1, firstName: 1 })
      .skip(opts.offset ?? 0)
      .limit(Math.min(opts.limit ?? 50, 200))
      .toArray(),
    collections().prescribers().countDocuments(q),
  ]);
  return { items: docs.map((d) => toPrescriberView(d, ctx.user.id)), total };
}

/** Identifiants des prescripteurs récemment utilisés par l'utilisateur. */
export async function recentPrescriberIds(ctx: UserContext, limit = 8): Promise<string[]> {
  const docs = await collections()
    .documents()
    .find({ organizationId: ctx.user.organizationId, authorId: ctx.user.id, prescriberId: { $ne: null } }, { projection: { prescriberId: 1 } })
    .sort({ updatedAt: -1 })
    .limit(40)
    .toArray();
  return [...new Set(docs.map((d) => d.prescriberId!))].slice(0, limit);
}

/**
 * Suggestions de l'autocomplétion : favoris et récents en tête, puis prescripteurs
 * associés au centre actif, puis le reste de l'annuaire.
 */
export async function suggestPrescribers(ctx: UserContext, query: string, limit = 12): Promise<PrescriberView[]> {
  const recent = await recentPrescriberIds(ctx);
  const recentSet = new Set(recent);
  const regex = query.trim() ? prefixWordsRegex(query) : null;
  const base: Filter<PrescriberDoc> = { organizationId: ctx.user.organizationId, archived: false };
  let docs: PrescriberDoc[];
  if (regex) {
    docs = await collections()
      .prescribers()
      .find({ ...base, searchText: regex })
      .limit(60)
      .toArray();
  } else {
    docs = await collections()
      .prescribers()
      .find({ ...base, $or: [{ favoriteOf: ctx.user.id }, { _id: { $in: recent } }, { centreIds: ctx.activeCentre._id }] })
      .limit(60)
      .toArray();
  }
  const score = (p: PrescriberDoc) =>
    (p.favoriteOf.includes(ctx.user.id) ? 0 : 10) +
    (recentSet.has(p._id) ? 0 : 5) +
    (p.centreIds.includes(ctx.activeCentre._id) ? 0 : 2);
  return docs
    .sort((a, b) => score(a) - score(b) || a.lastName.localeCompare(b.lastName, "fr"))
    .slice(0, limit)
    .map((p) => toPrescriberView(p, ctx.user.id, recentSet));
}

export async function getPrescriber(ctx: UserContext, id: string): Promise<PrescriberDoc> {
  const p = await collections().prescribers().findOne({ _id: id, organizationId: ctx.user.organizationId });
  if (!p) throw new UserFacingError("Prescripteur introuvable.");
  return p;
}

/** Fiches existantes susceptibles d'être le même prescripteur. */
export async function findSimilarPrescribers(organizationId: string, input: PrescriberInput, excludeId?: string): Promise<PrescriberDoc[]> {
  const keys = dedupeKeys(input);
  if (keys.length === 0) return [];
  const candidates = await collections()
    .prescribers()
    .find({
      organizationId,
      archived: false,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      $or: [
        ...(input.rpps ? [{ rpps: input.rpps }] : []),
        ...(input.email ? [{ email: input.email }] : []),
        { lastName: new RegExp(`^${input.lastName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      ],
    })
    .limit(20)
    .toArray();
  const wanted = new Set(keys);
  return candidates.filter((c) => dedupeKeys(c).some((k) => wanted.has(k)));
}

export async function createPrescriber(
  ctx: UserContext,
  raw: unknown,
  opts: { force?: boolean } = {},
): Promise<{ created: PrescriberView | null; similar: PrescriberView[] }> {
  assertCan(ctx.user, "prescriber.edit", ctx.organization.settings);
  const input = prescriberInputSchema.parse(raw);
  if (!opts.force) {
    const similar = await findSimilarPrescribers(ctx.user.organizationId, input);
    if (similar.length) return { created: null, similar: similar.map((s) => toPrescriberView(s, ctx.user.id)) };
  }
  const now = new Date();
  const doc: PrescriberDoc = {
    _id: randomUUID(),
    organizationId: ctx.user.organizationId,
    ...input,
    centreIds: input.centreIds.length ? input.centreIds : [ctx.activeCentre._id],
    favoriteOf: [],
    archived: false,
    searchText: prescriberSearchText(input),
    createdBy: ctx.user.id,
    createdAt: now,
    updatedAt: now,
  };
  await collections().prescribers().insertOne(doc);
  await audit(actor(ctx), "prescriber.create", "prescriber", doc._id);
  return { created: toPrescriberView(doc, ctx.user.id), similar: [] };
}

export async function updatePrescriber(ctx: UserContext, id: string, raw: unknown): Promise<PrescriberView> {
  assertCan(ctx.user, "prescriber.edit", ctx.organization.settings);
  const existing = await getPrescriber(ctx, id);
  const input = prescriberInputSchema.parse(raw);
  const set = { ...input, searchText: prescriberSearchText(input), updatedAt: new Date() };
  await collections().prescribers().updateOne({ _id: existing._id }, { $set: set });
  await audit(actor(ctx), "prescriber.update", "prescriber", id);
  return toPrescriberView({ ...existing, ...set }, ctx.user.id);
}

export async function setPrescriberArchived(ctx: UserContext, id: string, archived: boolean) {
  assertCan(ctx.user, "prescriber.archive", ctx.organization.settings);
  await getPrescriber(ctx, id);
  await collections().prescribers().updateOne({ _id: id }, { $set: { archived, updatedAt: new Date() } });
  await audit(actor(ctx), archived ? "prescriber.archive" : "prescriber.restore", "prescriber", id);
}

export async function toggleFavorite(ctx: UserContext, id: string): Promise<boolean> {
  const p = await getPrescriber(ctx, id);
  const isFav = p.favoriteOf.includes(ctx.user.id);
  await collections()
    .prescribers()
    .updateOne({ _id: id }, isFav ? { $pull: { favoriteOf: ctx.user.id } } : { $addToSet: { favoriteOf: ctx.user.id } });
  return !isFav;
}

export interface ImportReport {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

/** Import CSV : les doublons sont ignorés ou mis à jour (les champs vides de la fiche existante sont complétés). */
export async function importPrescribers(
  ctx: UserContext,
  rows: { row: number; value: PrescriberInput }[],
  opts: { updateExisting: boolean },
): Promise<ImportReport> {
  assertCan(ctx.user, "prescriber.import", ctx.organization.settings);
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };
  const existing = await collections().prescribers().find({ organizationId: ctx.user.organizationId, archived: false }).toArray();
  const byKey = new Map<string, PrescriberDoc>();
  for (const p of existing) for (const k of dedupeKeys(p)) byKey.set(k, p);
  const now = new Date();
  const toInsert: PrescriberDoc[] = [];
  for (const { row, value } of rows.slice(0, 5000)) {
    const parsed = prescriberInputSchema.safeParse(value);
    if (!parsed.success) {
      report.errors.push({ row, error: parsed.error.issues[0]?.message ?? "Ligne invalide" });
      continue;
    }
    const input = parsed.data;
    const match = dedupeKeys(input)
      .map((k) => byKey.get(k))
      .find(Boolean);
    if (match) {
      if (opts.updateExisting) {
        const patch = mergeFields(
          { ...match, ...match.address } as unknown as Record<string, unknown>,
          [{ ...input, ...input.address } as unknown as Record<string, unknown>],
          ["firstName", "rpps", "practiceName", "email", "phone", "salutation", "notes", "line1", "line2", "postalCode", "city"],
        );
        if (Object.keys(patch).length) {
          const { line1, line2, postalCode, city, ...rest } = patch as Record<string, string>;
          const address = { ...match.address, ...(line1 !== undefined ? { line1 } : {}), ...(line2 !== undefined ? { line2 } : {}), ...(postalCode !== undefined ? { postalCode } : {}), ...(city !== undefined ? { city } : {}) };
          const merged = { ...match, ...rest, address };
          await collections()
            .prescribers()
            .updateOne({ _id: match._id }, { $set: { ...rest, address, searchText: prescriberSearchText(merged), updatedAt: now } });
          report.updated++;
        } else report.skipped++;
      } else report.skipped++;
      continue;
    }
    const doc: PrescriberDoc = {
      _id: randomUUID(),
      organizationId: ctx.user.organizationId,
      ...input,
      favoriteOf: [],
      archived: false,
      searchText: prescriberSearchText(input),
      createdBy: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    };
    toInsert.push(doc);
    for (const k of dedupeKeys(doc)) byKey.set(k, doc);
  }
  if (toInsert.length) await collections().prescribers().insertMany(toInsert);
  report.created = toInsert.length;
  await audit(actor(ctx), "prescriber.import", "prescriber", null, { created: report.created, updated: report.updated, skipped: report.skipped });
  return report;
}

export async function listDuplicateGroups(ctx: UserContext): Promise<PrescriberView[][]> {
  assertCan(ctx.user, "prescriber.merge", ctx.organization.settings);
  const all = await collections().prescribers().find({ organizationId: ctx.user.organizationId, archived: false }).toArray();
  return findDuplicateGroups(all).map((g) => g.map((p) => toPrescriberView(p, ctx.user.id)));
}

/** Fusion : les documents, patients et envois sont rattachés à la fiche principale ; les autres sont archivées. */
export async function mergePrescribers(ctx: UserContext, masterId: string, otherIds: string[]) {
  assertCan(ctx.user, "prescriber.merge", ctx.organization.settings);
  const master = await getPrescriber(ctx, masterId);
  const others = await collections()
    .prescribers()
    .find({ _id: { $in: otherIds.filter((id) => id !== masterId) }, organizationId: ctx.user.organizationId })
    .toArray();
  // Seules les fiches de l'organisation sont fusionnées (identifiants filtrés côté serveur).
  const ids = others.map((o) => o._id);
  if (ids.length === 0) throw new UserFacingError("Sélectionnez au moins une fiche à fusionner.");
  const organizationId = ctx.user.organizationId;
  const flat = (p: PrescriberDoc) => ({ ...p, ...Object.fromEntries(Object.entries(p.address).map(([k, v]) => [`address.${k}`, v])) });
  const patch = mergeFields(flat(master) as unknown as Record<string, unknown>, others.map((o) => flat(o) as unknown as Record<string, unknown>), [
    "firstName",
    "rpps",
    "practiceName",
    "email",
    "phone",
    "salutation",
    "address.line1",
    "address.line2",
    "address.postalCode",
    "address.city",
  ]);
  const notes = [master.notes, ...others.map((o) => o.notes)].filter(Boolean).join("\n");
  const favoriteOf = [...new Set([master, ...others].flatMap((p) => p.favoriteOf))];
  const centreIds = [...new Set([master, ...others].flatMap((p) => p.centreIds))];
  const now = new Date();
  const merged = { ...master, ...(patch as Partial<PrescriberDoc>) };
  await collections()
    .prescribers()
    .updateOne(
      { _id: master._id },
      { $set: { ...(patch as Record<string, unknown>), notes, favoriteOf, centreIds, searchText: prescriberSearchText(merged), updatedAt: now } },
    );
  await Promise.all([
    collections().documents().updateMany({ organizationId, prescriberId: { $in: ids } }, { $set: { prescriberId: master._id } }),
    collections().patients().updateMany({ organizationId, usualPrescriberId: { $in: ids } }, { $set: { usualPrescriberId: master._id } }),
    collections().dispatches().updateMany({ organizationId, prescriberId: { $in: ids } }, { $set: { prescriberId: master._id } }),
    collections()
      .prescribers()
      .updateMany({ organizationId, _id: { $in: ids } }, { $set: { archived: true, notes: `Fusionné dans la fiche ${master._id}`, updatedAt: now } }),
  ]);
  await audit(actor(ctx), "prescriber.merge", "prescriber", master._id, { merged: ids.join(",") });
}
