import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import { collections } from "@/lib/db/collections";
import type { PatientDoc } from "@/lib/db/types";
import { assertCan, assertCentre } from "@/lib/auth/permissions";
import type { UserContext } from "@/lib/auth/session";
import { patientInputSchema } from "@/lib/schemas/patient";
import { patientSearchText } from "@/lib/search-text";
import { prefixWordsRegex } from "@/lib/text";
import { UserFacingError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { storage } from "@/server/services/storage";
import { actor } from "./documents";

export interface PatientView {
  id: string;
  civility: "Mme" | "M.";
  firstName: string;
  lastName: string;
  birthDate: string;
  centreId: string;
  usualPrescriberId: string | null;
  updatedAt: string;
}

export function toPatientView(p: PatientDoc): PatientView {
  return {
    id: p._id,
    civility: p.civility,
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate,
    centreId: p.centreId,
    usualPrescriberId: p.usualPrescriberId,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listPatients(
  ctx: UserContext,
  opts: { q?: string; scope?: "active" | "all"; limit?: number; offset?: number },
): Promise<{ items: PatientView[]; total: number }> {
  const centreIds = opts.scope === "all" ? ctx.centres.map((c) => c._id) : [ctx.activeCentre._id];
  const q: Filter<PatientDoc> = { organizationId: ctx.user.organizationId, centreId: { $in: centreIds } };
  const regex = opts.q ? prefixWordsRegex(opts.q) : null;
  if (regex) q.searchText = regex;
  const [docs, total] = await Promise.all([
    collections()
      .patients()
      .find(q)
      .sort(regex ? { lastName: 1 } : { updatedAt: -1 })
      .skip(opts.offset ?? 0)
      .limit(Math.min(opts.limit ?? 50, 200))
      .toArray(),
    collections().patients().countDocuments(q),
  ]);
  return { items: docs.map(toPatientView), total };
}

export async function getPatient(ctx: UserContext, id: string): Promise<PatientDoc> {
  const p = await collections().patients().findOne({ _id: id, organizationId: ctx.user.organizationId });
  if (!p) throw new UserFacingError("Patient introuvable.");
  assertCentre(ctx.user, p.centreId);
  return p;
}

export async function findSimilarPatients(organizationId: string, centreId: string, input: { firstName: string; lastName: string; birthDate: string }, excludeId?: string) {
  const text = patientSearchText({ ...input, birthDate: "" });
  const docs = await collections()
    .patients()
    .find({ organizationId, centreId, ...(excludeId ? { _id: { $ne: excludeId } } : {}), searchText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })
    .limit(5)
    .toArray();
  return docs.filter((d) => !input.birthDate || !d.birthDate || d.birthDate === input.birthDate);
}

/** Le prescripteur habituel doit appartenir à l'organisation (sinon il est ignoré). */
async function checkedPrescriberId(organizationId: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  const p = await collections().prescribers().findOne({ _id: id, organizationId }, { projection: { _id: 1 } });
  return p?._id ?? null;
}

export async function createPatient(ctx: UserContext, raw: unknown, opts: { force?: boolean } = {}): Promise<{ created: PatientView | null; similar: PatientView[] }> {
  assertCan(ctx.user, "patient.edit", ctx.organization.settings);
  const input = patientInputSchema.parse({ centreId: ctx.activeCentre._id, ...(raw as object) });
  assertCentre(ctx.user, input.centreId);
  input.usualPrescriberId = await checkedPrescriberId(ctx.user.organizationId, input.usualPrescriberId);
  if (!opts.force) {
    const similar = await findSimilarPatients(ctx.user.organizationId, input.centreId, input);
    if (similar.length) return { created: null, similar: similar.map(toPatientView) };
  }
  const now = new Date();
  const doc: PatientDoc = {
    _id: randomUUID(),
    organizationId: ctx.user.organizationId,
    ...input,
    searchText: patientSearchText(input),
    createdBy: ctx.user.id,
    createdAt: now,
    updatedAt: now,
  };
  await collections().patients().insertOne(doc);
  await audit(actor(ctx), "patient.create", "patient", doc._id);
  return { created: toPatientView(doc), similar: [] };
}

export async function updatePatient(ctx: UserContext, id: string, raw: unknown): Promise<PatientView> {
  assertCan(ctx.user, "patient.edit", ctx.organization.settings);
  const existing = await getPatient(ctx, id);
  const input = patientInputSchema.parse({ centreId: existing.centreId, ...(raw as object) });
  assertCentre(ctx.user, input.centreId);
  input.usualPrescriberId = await checkedPrescriberId(ctx.user.organizationId, input.usualPrescriberId);
  const set = { ...input, searchText: patientSearchText(input), updatedAt: new Date() };
  await collections().patients().updateOne({ _id: id }, { $set: set });
  await audit(actor(ctx), "patient.update", "patient", id);
  return toPatientView({ ...existing, ...set });
}

/** Suppression définitive d'un patient et de tout ce qui le concerne (droit à l'effacement). */
export async function deletePatientCascade(organizationId: string, patientId: string) {
  const docs = await collections().documents().find({ organizationId, patientId }).toArray();
  const docIds = docs.map((d) => d._id);
  const [attachments, dispatches] = await Promise.all([
    collections().attachments().find({ organizationId, documentId: { $in: docIds } }).toArray(),
    collections().dispatches().find({ organizationId, documentId: { $in: docIds } }).toArray(),
  ]);
  const keys = [
    ...docs.flatMap((d) => (d.pdfKey ? [d.pdfKey] : [])),
    ...attachments.map((a) => a.fileKey),
    ...dispatches.flatMap((d) => [d.pdfKey, d.proofKey].filter((k): k is string => Boolean(k))),
  ];
  for (const key of keys) await storage().delete(key).catch(() => undefined);
  await Promise.all([
    collections().secureLinks().deleteMany({ documentId: { $in: docIds } }),
    collections().dispatches().deleteMany({ documentId: { $in: docIds } }),
    collections().attachments().deleteMany({ documentId: { $in: docIds } }),
    collections().documents().deleteMany({ _id: { $in: docIds } }),
    collections().patients().deleteOne({ _id: patientId, organizationId }),
  ]);
  return { documents: docIds.length, files: keys.length };
}

export async function deletePatient(ctx: UserContext, id: string) {
  assertCan(ctx.user, "patient.delete", ctx.organization.settings);
  await getPatient(ctx, id);
  const res = await deletePatientCascade(ctx.user.organizationId, id);
  await audit(actor(ctx), "patient.delete", "patient", id, { documents: res.documents });
  return res;
}
