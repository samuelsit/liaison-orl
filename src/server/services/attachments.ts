import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { collections } from "@/lib/db/collections";
import type { AttachmentDoc, DocumentDoc } from "@/lib/db/types";
import type { UserContext } from "@/lib/auth/session";
import { assertCentre } from "@/lib/auth/permissions";
import { ACCEPTED_BILAN_TYPES, MAX_BILAN_BYTES, MAX_BILANS_PER_DOCUMENT, type AttachmentView } from "@/lib/schemas/attachment";
import { audiometrySchema, bilanConditionSchema, type Audiometry, type BilanCondition, type Conflict } from "@/lib/schemas/audiometry";
import type { BilanView, DocumentBilan } from "@/lib/schemas/document";
import { countAllMeasures } from "@/lib/audiology/calculations";
import { mergeExtractions, type MergeSource } from "@/lib/audiology/merge";
import { getMeasure } from "@/lib/audiology/refs";
import { UserFacingError } from "@/server/actions/result";
import { DEMO_MARKER, readDemoMarker } from "@/ai/mock";
import { audit } from "@/server/audit";
import { actor, getDocumentForUser } from "./documents";
import { storage, storageKeys } from "./storage";

export type { AttachmentView };

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function parseAudiometry(raw: unknown): Audiometry | null {
  if (!raw) return null;
  const parsed = audiometrySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function toAttachmentView(a: AttachmentDoc): AttachmentView {
  return {
    id: a._id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    size: a.size,
    extractionStatus: a.extractionStatus,
    extractionError: a.extractionError,
    aidedSheet: a.aidedSheet ?? false,
    condition: a.condition ?? "auto",
    createdAt: a.createdAt.toISOString(),
    extraction: parseAudiometry(a.extraction),
  };
}

export function toBilanView(b: DocumentBilan | null): BilanView | null {
  if (!b) return null;
  return { audiometry: parseAudiometry(b.audiometry), conflicts: b.conflicts ?? [], confirmed: b.confirmed, updatedAt: b.updatedAt.toISOString() };
}

/** Vérifie la signature binaire du fichier (et pas seulement le type annoncé). */
export function sniffMime(buf: Buffer): (typeof ACCEPTED_BILAN_TYPES)[number] | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function uploadBilan(ctx: UserContext, documentId: string, file: { name: string; data: Buffer }): Promise<AttachmentDoc> {
  const doc = await getDocumentForUser(ctx, documentId);
  if (doc.type !== "COMPTE_RENDU") throw new UserFacingError("Le bilan auditif se joint à un compte rendu d'appareillage.");
  if (doc.status !== "BROUILLON") throw new UserFacingError("Rouvrez le document pour joindre un bilan.");
  if (file.data.length > MAX_BILAN_BYTES) throw new UserFacingError("Fichier trop volumineux (4 Mo maximum). Exportez le bilan en PDF ou reprenez la photo.");
  const existing = await collections().attachments().countDocuments({ documentId: doc._id });
  if (existing >= MAX_BILANS_PER_DOCUMENT) {
    throw new UserFacingError(`Au plus ${MAX_BILANS_PER_DOCUMENT} fichiers par compte rendu : retirez un fichier avant d'en ajouter un autre.`);
  }
  const mime = sniffMime(file.data);
  if (!mime) throw new UserFacingError("Format non reconnu : déposez un PDF ou une image (JPEG, PNG, WebP).");
  let data = file.data;
  // Les photos sont nettoyées de leurs métadonnées (EXIF, géolocalisation) et redressées.
  if (mime !== "application/pdf") {
    // Seule exception : le marqueur des bilans fictifs de démonstration est conservé.
    const demo = readDemoMarker(file.data);
    const img = sharp(file.data).rotate();
    data = demo ? await img.withExif({ IFD0: { ImageDescription: `${DEMO_MARKER}${Buffer.from(JSON.stringify(demo)).toString("base64")}` } }).toBuffer() : await img.toBuffer();
  }
  const id = randomUUID();
  const key = storageKeys.attachment(doc.organizationId, id, EXT[mime]!);
  await storage().put(key, data, mime);
  const now = new Date();
  const att: AttachmentDoc = {
    _id: id,
    organizationId: doc.organizationId,
    centreId: doc.centreId,
    documentId: doc._id,
    patientId: doc.patientId,
    kind: "bilan",
    fileKey: key,
    fileName: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || `bilan.${EXT[mime]}`,
    mimeType: mime,
    size: data.length,
    extraction: null,
    extractionStatus: "pending",
    extractionError: null,
    aidedSheet: false,
    condition: "auto",
    createdBy: ctx.user.id,
    createdAt: now,
    updatedAt: now,
  };
  await collections().attachments().insertOne(att);
  await audit(actor(ctx), "attachment.upload", "attachment", id, { documentId: doc._id, mimeType: mime, size: data.length });
  return att;
}

export async function getAttachmentForUser(ctx: UserContext, id: string): Promise<AttachmentDoc> {
  const a = await collections().attachments().findOne({ _id: id, organizationId: ctx.user.organizationId });
  if (!a) throw new UserFacingError("Pièce jointe introuvable.");
  assertCentre(ctx.user, a.centreId);
  return a;
}

async function requireDraft(ctx: UserContext, documentId: string, action: string): Promise<DocumentDoc> {
  const doc = await getDocumentForUser(ctx, documentId);
  if (doc.type !== "COMPTE_RENDU") throw new UserFacingError("Le bilan auditif se joint à un compte rendu d'appareillage.");
  if (doc.status !== "BROUILLON") throw new UserFacingError(`Rouvrez le document pour ${action}.`);
  return doc;
}

/**
 * Recalcule le bilan fusionné du document à partir de tous les fichiers lus, en
 * conservant les valeurs saisies à la main. Les fichiers ayant changé, la
 * confirmation est levée : l'audioprothésiste revérifie avant de continuer.
 */
export async function rebuildBilan(ctx: UserContext, documentId: string): Promise<DocumentBilan> {
  const doc = await requireDraft(ctx, documentId, "modifier le bilan");
  const attachments = await collections().attachments().find({ documentId: doc._id }).sort({ createdAt: 1 }).toArray();
  const sources: MergeSource[] = [];
  for (const a of attachments) {
    const audiometry = a.extractionStatus === "done" || a.extractionStatus === "manual" ? parseAudiometry(a.extraction) : null;
    if (audiometry) sources.push({ id: a._id, fileName: a.fileName, createdAt: a.createdAt, audiometry, condition: a.condition ?? "auto", aidedSheet: a.aidedSheet ?? false });
  }
  const previous = parseAudiometry(doc.bilan?.audiometry);
  const merged = mergeExtractions(sources, previous);
  const now = new Date();
  const bilan: DocumentBilan = {
    audiometry: sources.length || (merged.audiometry && countAllMeasures(merged.audiometry) > 0) ? merged.audiometry : null,
    conflicts: merged.conflicts,
    confirmed: false,
    confirmedAt: null,
    confirmedBy: null,
    updatedAt: now,
  };
  await collections().documents().updateOne({ _id: doc._id, status: "BROUILLON" }, { $set: { bilan, updatedAt: now } });
  return bilan;
}

/** Un conflit ne subsiste que si la cellule porte encore la lecture retenue (non corrigée à la main). */
function liveConflicts(conflicts: Conflict[], audiometry: Audiometry): Conflict[] {
  return conflicts.filter((c) => {
    const m = getMeasure(audiometry, c.ref);
    return Boolean(m && m.source && m.source === c.kept.attachmentId);
  });
}

/** Enregistre les corrections du bilan fusionné ; `confirm` le valide pour le compte rendu. */
export async function saveBilan(ctx: UserContext, documentId: string, raw: unknown, confirm: boolean): Promise<DocumentBilan> {
  const doc = await requireDraft(ctx, documentId, "modifier les mesures");
  const audiometry = audiometrySchema.parse(raw);
  const now = new Date();
  const bilan: DocumentBilan = {
    audiometry,
    conflicts: liveConflicts(doc.bilan?.conflicts ?? [], audiometry),
    confirmed: confirm,
    confirmedAt: confirm ? now : null,
    confirmedBy: confirm ? ctx.user.id : null,
    updatedAt: now,
  };
  await collections().documents().updateOne({ _id: doc._id, status: "BROUILLON" }, { $set: { bilan, updatedAt: now } });
  if (confirm) await audit(actor(ctx), "bilan.confirm", "document", doc._id, { measures: countAllMeasures(audiometry), conflicts: bilan.conflicts.length });
  return bilan;
}

/** Interprétation d'un fichier (automatique / sans appareil / avec appareils), puis recalcul de la fusion. */
export async function setAttachmentCondition(ctx: UserContext, id: string, condition: unknown): Promise<{ attachment: AttachmentDoc; bilan: DocumentBilan }> {
  const att = await getAttachmentForUser(ctx, id);
  const parsed = bilanConditionSchema.parse(condition) as BilanCondition;
  await requireDraft(ctx, att.documentId, "modifier le bilan");
  const now = new Date();
  await collections().attachments().updateOne({ _id: id }, { $set: { condition: parsed, updatedAt: now } });
  const bilan = await rebuildBilan(ctx, att.documentId);
  return { attachment: { ...att, condition: parsed, updatedAt: now }, bilan };
}

export async function deleteAttachment(ctx: UserContext, id: string): Promise<DocumentBilan> {
  const att = await getAttachmentForUser(ctx, id);
  await requireDraft(ctx, att.documentId, "retirer un fichier du bilan");
  await storage().delete(att.fileKey).catch(() => undefined);
  await collections().attachments().deleteOne({ _id: id });
  return rebuildBilan(ctx, att.documentId);
}
