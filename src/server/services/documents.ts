import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import { collections } from "@/lib/db/collections";
import type { DocumentDoc } from "@/lib/db/types";
import { assertCan, assertCentre } from "@/lib/auth/permissions";
import type { UserContext } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { defaultDataFor } from "@/lib/documents/defaults";
import { dataSchemaFor, type DocumentData, type DocumentStatus, type DocumentType } from "@/lib/schemas/document";
import { UserFacingError } from "@/server/actions/result";
import { audit } from "@/server/audit";

export async function createDocument(
  ctx: UserContext,
  type: DocumentType,
  opts: { patientId?: string | null; prescriberId?: string | null } = {},
): Promise<DocumentDoc> {
  assertCan(ctx.user, "document.create", ctx.organization.settings);
  const userDoc = await collections().users().findOne({ _id: ctx.user.id });
  let patientId: string | null = null;
  let prescriberId: string | null = null;
  if (opts.prescriberId) {
    const prescriber = await collections().prescribers().findOne({ _id: opts.prescriberId, organizationId: ctx.user.organizationId, archived: false });
    prescriberId = prescriber?._id ?? null;
  }
  if (opts.patientId) {
    const patient = await collections().patients().findOne({ _id: opts.patientId, organizationId: ctx.user.organizationId });
    if (patient && ctx.centres.some((c) => c._id === patient.centreId)) {
      patientId = patient._id;
      prescriberId = prescriberId ?? patient.usualPrescriberId;
    }
  }
  const now = new Date();
  const doc: DocumentDoc = {
    _id: randomUUID(),
    organizationId: ctx.user.organizationId,
    centreId: ctx.activeCentre._id,
    type,
    status: "BROUILLON",
    patientId,
    prescriberId,
    authorId: ctx.user.id,
    data:
      type === "COMPTE_RENDU"
        ? { ...(defaultDataFor(type, todayIso(), userDoc?.preferences?.learned) as object), includeAnnex: ctx.organization.settings.documents.audiogramAnnex } as DocumentData
        : defaultDataFor(type, todayIso(), userDoc?.preferences?.learned),
    aiFields: [],
    version: 0,
    pdfKey: null,
    snapshot: null,
    validatedAt: null,
    validatedBy: null,
    sentAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  await collections().documents().insertOne(doc);
  await audit(actor(ctx), "document.create", "document", doc._id, { type });
  return doc;
}

export function actor(ctx: UserContext) {
  return { id: ctx.user.id, fullName: ctx.user.fullName, organizationId: ctx.user.organizationId };
}

/** Charge un document en vérifiant l'organisation et le centre. */
export async function getDocumentForUser(ctx: UserContext, id: string): Promise<DocumentDoc> {
  const doc = await collections().documents().findOne({ _id: id, organizationId: ctx.user.organizationId });
  if (!doc) throw new UserFacingError("Document introuvable ou supprimé.");
  assertCentre(ctx.user, doc.centreId);
  return doc;
}

export interface DraftPatch {
  data: unknown;
  patientId: string | null;
  prescriberId: string | null;
  aiFields: string[];
}

export async function saveDraft(ctx: UserContext, id: string, patch: DraftPatch): Promise<{ updatedAt: Date }> {
  const doc = await getDocumentForUser(ctx, id);
  assertCan(ctx.user, "document.edit", ctx.organization.settings);
  if (doc.status !== "BROUILLON") {
    throw new UserFacingError("Ce document est validé : rouvrez-le pour le modifier.");
  }
  const data = dataSchemaFor(doc.type).parse(patch.data) as DocumentData;
  if (patch.patientId) {
    const patient = await collections().patients().findOne({ _id: patch.patientId, organizationId: ctx.user.organizationId });
    if (!patient) throw new UserFacingError("Patient introuvable.");
    assertCentre(ctx.user, patient.centreId);
  }
  if (patch.prescriberId) {
    const p = await collections().prescribers().findOne({ _id: patch.prescriberId, organizationId: ctx.user.organizationId });
    if (!p) throw new UserFacingError("Prescripteur introuvable.");
  }
  const updatedAt = new Date();
  await collections()
    .documents()
    .updateOne(
      { _id: doc._id, status: "BROUILLON" },
      {
        $set: {
          data,
          patientId: patch.patientId,
          prescriberId: patch.prescriberId,
          aiFields: [...new Set(patch.aiFields)].slice(0, 50),
          updatedAt,
        },
      },
    );
  // Journalisation espacée : une entrée par tranche de 10 minutes et par document.
  const recent = await collections()
    .auditLogs()
    .findOne({ entityId: doc._id, action: "document.update", userId: ctx.user.id, at: { $gt: new Date(Date.now() - 10 * 60_000) } });
  if (!recent) await audit(actor(ctx), "document.update", "document", doc._id);
  return { updatedAt };
}

export interface DocumentListFilter {
  status?: DocumentStatus | DocumentStatus[];
  type?: DocumentType;
  centreIds: string[];
  patientId?: string;
  prescriberId?: string;
  authorId?: string;
}

export async function listDocuments(organizationId: string, filter: DocumentListFilter, limit = 50): Promise<DocumentDoc[]> {
  const q: Filter<DocumentDoc> = { organizationId, centreId: { $in: filter.centreIds } };
  if (filter.status) q.status = Array.isArray(filter.status) ? { $in: filter.status } : filter.status;
  if (filter.type) q.type = filter.type;
  if (filter.patientId) q.patientId = filter.patientId;
  if (filter.prescriberId) q.prescriberId = filter.prescriberId;
  if (filter.authorId) q.authorId = filter.authorId;
  return collections().documents().find(q).sort({ updatedAt: -1 }).limit(limit).toArray();
}

/* ---------- Aperçu, validation, réouverture, suppression ---------- */

export interface PreviewInput {
  data: unknown;
  patientId: string | null;
  prescriberId: string | null;
}

/** Rendu de l'aperçu à partir des valeurs en cours de saisie (non enregistrées). */
export async function renderPreview(ctx: UserContext, id: string, input: PreviewInput) {
  const doc = await getDocumentForUser(ctx, id);
  if (doc.status !== "BROUILLON" && doc.snapshot) {
    const centre = await collections().centres().findOne({ _id: doc.centreId });
    const { renderPdf } = await import("@/lib/pdf/render");
    const { modelFromSnapshot } = await import("./pdf-model");
    return renderPdf(modelFromSnapshot(ctx.organization, centre!, doc));
  }
  const parsed = dataSchemaFor(doc.type).safeParse(input.data);
  const data = (parsed.success ? parsed.data : doc.data) as DocumentData;
  const { loadLiveEntities, modelFromLive, confirmedAudiometry } = await import("./pdf-model");
  const e = await loadLiveEntities(doc, input.patientId, input.prescriberId);
  if (e.patient) assertCentre(ctx.user, e.patient.centreId);
  const audiometry = doc.type === "COMPTE_RENDU" ? await confirmedAudiometry(data, doc._id) : null;
  const { renderPdf } = await import("@/lib/pdf/render");
  return renderPdf(modelFromLive({ ...e, org: ctx.organization }, { type: doc.type, data }, { draft: true, audiometry }));
}

export async function validateDocument(ctx: UserContext, id: string) {
  const doc = await getDocumentForUser(ctx, id);
  assertCan(ctx.user, "document.validate", ctx.organization.settings);
  if (doc.status !== "BROUILLON") throw new UserFacingError("Ce document est déjà validé.");
  const data = dataSchemaFor(doc.type).parse(doc.data) as DocumentData;
  const { loadLiveEntities, modelFromLive, buildSnapshot, confirmedAudiometry } = await import("./pdf-model");
  const e = await loadLiveEntities(doc, doc.patientId, doc.prescriberId);
  const { checkDocument, isValid } = await import("@/lib/documents/validation");
  const report = checkDocument({
    type: doc.type,
    data,
    patient: e.patient ? { birthDate: e.patient.birthDate } : null,
    prescriber: e.prescriber ? { email: e.prescriber.email ?? "", address: e.prescriber.address } : null,
  });
  if (!isValid(report)) return { ok: false as const, errors: report.errors, warnings: report.warnings };
  const audiometry = doc.type === "COMPTE_RENDU" ? await confirmedAudiometry(data, doc._id) : null;
  const { renderPdf } = await import("@/lib/pdf/render");
  const live = { ...e, org: ctx.organization };
  const version = doc.version + 1;
  const { buffer } = await renderPdf(modelFromLive(live, { type: doc.type, data }, { draft: false, audiometry }));
  const { storage, storageKeys } = await import("./storage");
  const key = storageKeys.documentPdf(doc.organizationId, doc._id, version);
  await storage().put(key, buffer, "application/pdf");
  const now = new Date();
  await collections()
    .documents()
    .updateOne(
      { _id: doc._id, status: "BROUILLON" },
      {
        $set: {
          status: "VALIDE",
          version,
          pdfKey: key,
          snapshot: buildSnapshot(live, audiometry),
          validatedAt: now,
          validatedBy: ctx.user.id,
          aiFields: [],
          lastError: null,
          updatedAt: now,
        },
      },
    );
  if (e.patient && !e.patient.usualPrescriberId && e.prescriber) {
    await collections().patients().updateOne({ _id: e.patient._id }, { $set: { usualPrescriberId: e.prescriber._id } });
  }
  if (doc.type === "COMPTE_RENDU") {
    const { learnFrom } = await import("@/lib/documents/defaults");
    const user = await collections().users().findOne({ _id: doc.authorId });
    await collections()
      .users()
      .updateOne({ _id: doc.authorId }, { $set: { "preferences.learned": learnFrom(user?.preferences?.learned, data as never) } });
  }
  await audit(actor(ctx), "document.validate", "document", doc._id, { version });
  return { ok: true as const, version, warnings: report.warnings };
}

export async function reopenDocument(ctx: UserContext, id: string) {
  const doc = await getDocumentForUser(ctx, id);
  if (doc.status === "BROUILLON") return;
  // Rouvrir un document validé ou envoyé revient à le dévalider : réservé à qui peut valider.
  assertCan(ctx.user, "document.validate", ctx.organization.settings);
  await collections().documents().updateOne({ _id: doc._id }, { $set: { status: "BROUILLON", updatedAt: new Date() } });
  await audit(actor(ctx), "document.reopen", "document", doc._id, { version: doc.version });
}

export async function deleteDocument(ctx: UserContext, id: string) {
  const doc = await getDocumentForUser(ctx, id);
  const sent = await collections().dispatches().countDocuments({ documentId: doc._id });
  if (sent > 0 && ctx.user.role !== "admin") throw new UserFacingError("Un document déjà envoyé ne peut pas être supprimé (historique des envois).");
  if (doc.status !== "BROUILLON") assertCan(ctx.user, "document.delete", ctx.organization.settings);
  else if (doc.authorId !== ctx.user.id && ctx.user.role === "assistant") throw new UserFacingError("Seul l'auteur ou un audioprothésiste peut supprimer ce brouillon.");
  const { storage } = await import("./storage");
  const attachments = await collections().attachments().find({ documentId: doc._id }).toArray();
  for (const key of [doc.pdfKey, ...attachments.map((a) => a.fileKey)].filter((k): k is string => Boolean(k))) await storage().delete(key).catch(() => undefined);
  await collections().attachments().deleteMany({ documentId: doc._id });
  await collections().documents().deleteOne({ _id: doc._id });
  await audit(actor(ctx), "document.delete", "document", doc._id, { type: doc.type, status: doc.status });
}
