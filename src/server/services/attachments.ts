import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { collections } from "@/lib/db/collections";
import type { AttachmentDoc } from "@/lib/db/types";
import type { UserContext } from "@/lib/auth/session";
import { assertCentre } from "@/lib/auth/permissions";
import { ACCEPTED_BILAN_TYPES, MAX_BILAN_BYTES } from "@/lib/schemas/attachment";
import { audiometrySchema, type Audiometry } from "@/lib/schemas/audiometry";
import { UserFacingError } from "@/server/actions/result";
import { DEMO_MARKER, readDemoMarker } from "@/ai/mock";
import { audit } from "@/server/audit";
import { actor, getDocumentForUser } from "./documents";
import { storage, storageKeys } from "./storage";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  extractionStatus: AttachmentDoc["extractionStatus"];
  extractionError: string | null;
  confirmed: boolean;
  createdAt: string;
  extraction: Audiometry | null;
}

export function toAttachmentView(a: AttachmentDoc): AttachmentView {
  const parsed = a.extraction ? audiometrySchema.safeParse(a.extraction) : null;
  return {
    id: a._id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    size: a.size,
    extractionStatus: a.extractionStatus,
    extractionError: a.extractionError,
    confirmed: a.confirmed,
    createdAt: a.createdAt.toISOString(),
    extraction: parsed?.success ? parsed.data : null,
  };
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
    confirmed: false,
    confirmedAt: null,
    confirmedBy: null,
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

/** Enregistre les mesures corrigées ; `confirm` les rattache au compte rendu. */
export async function saveExtraction(ctx: UserContext, id: string, raw: unknown, confirm: boolean): Promise<AttachmentDoc> {
  const att = await getAttachmentForUser(ctx, id);
  const doc = await getDocumentForUser(ctx, att.documentId);
  if (doc.status !== "BROUILLON") throw new UserFacingError("Rouvrez le document pour modifier les mesures.");
  const extraction = audiometrySchema.parse(raw);
  const now = new Date();
  const set: Partial<AttachmentDoc> = {
    extraction,
    extractionStatus: att.extractionStatus === "pending" || att.extractionStatus === "failed" ? "manual" : att.extractionStatus,
    confirmed: confirm,
    confirmedAt: confirm ? now : null,
    confirmedBy: confirm ? ctx.user.id : null,
    updatedAt: now,
  };
  await collections().attachments().updateOne({ _id: id }, { $set: set });
  if (confirm) {
    await collections()
      .documents()
      .updateOne({ _id: doc._id }, { $set: { "data.attachmentId": id, updatedAt: now } });
    await audit(actor(ctx), "attachment.confirm", "attachment", id, { documentId: doc._id });
  }
  return { ...att, ...set };
}

export async function deleteAttachment(ctx: UserContext, id: string) {
  const att = await getAttachmentForUser(ctx, id);
  const doc = await getDocumentForUser(ctx, att.documentId);
  if (doc.status !== "BROUILLON") throw new UserFacingError("Rouvrez le document pour retirer le bilan.");
  await storage().delete(att.fileKey).catch(() => undefined);
  await collections().attachments().deleteOne({ _id: id });
  if ((doc.data as { attachmentId?: string | null }).attachmentId === id) {
    await collections().documents().updateOne({ _id: doc._id }, { $set: { "data.attachmentId": null, updatedAt: new Date() } });
  }
}
