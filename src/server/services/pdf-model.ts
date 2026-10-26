import "server-only";
import { collections } from "@/lib/db/collections";
import { getOrganization } from "@/server/repositories/organizations";
import type { CentreDoc, DocumentDoc, OrganizationDoc, PatientDoc, PrescriberDoc, UserDoc } from "@/lib/db/types";
import { centreDisplayName } from "@/lib/brand";
import { audiometrySchema, type Audiometry } from "@/lib/schemas/audiometry";
import type { AdressageData, CompteRenduData, DocumentData, DocumentSnapshot } from "@/lib/schemas/document";
import type { PdfModel, PdfPatient, PdfPrescriber } from "@/lib/pdf/model";

export function pdfBrand(org: OrganizationDoc) {
  return { name: org.brand.name, slogan: org.brand.slogan, logo: org.brand.logo, colors: org.brand.colors, font: org.brand.fonts.document };
}

export function pdfCentre(org: OrganizationDoc, centre: CentreDoc) {
  return {
    name: centre.name,
    displayName: centreDisplayName(org.brand.name, centre.name),
    address: centre.address,
    phone: centre.phone,
    email: centre.email,
    senderAddress: centre.senderAddress,
  };
}

export function patientSnapshot(p: PatientDoc | null): PdfPatient | null {
  return p ? { civility: p.civility, firstName: p.firstName, lastName: p.lastName, birthDate: p.birthDate } : null;
}

export function prescriberSnapshot(p: PrescriberDoc | null): (PdfPrescriber & { email: string }) | null {
  return p
    ? { civility: p.civility, firstName: p.firstName, lastName: p.lastName, salutation: p.salutation, practiceName: p.practiceName, address: p.address, email: p.email ?? "" }
    : null;
}

/** Mesures confirmées du bilan joint à un compte rendu. */
export async function confirmedAudiometry(data: DocumentData, documentId: string): Promise<Audiometry | null> {
  const attachmentId = (data as CompteRenduData).attachmentId;
  if (!attachmentId) return null;
  const att = await collections().attachments().findOne({ _id: attachmentId, documentId });
  if (!att?.extraction) return null;
  const parsed = audiometrySchema.safeParse(att.extraction);
  return parsed.success ? parsed.data : null;
}

export interface LiveEntities {
  org: OrganizationDoc;
  centre: CentreDoc;
  author: UserDoc | null;
  patient: PatientDoc | null;
  prescriber: PrescriberDoc | null;
}

export async function loadLiveEntities(doc: Pick<DocumentDoc, "organizationId" | "centreId" | "authorId">, patientId: string | null, prescriberId: string | null): Promise<Omit<LiveEntities, "org"> & { org: OrganizationDoc | null }> {
  const [org, centre, author, patient, prescriber] = await Promise.all([
    getOrganization(doc.organizationId),
    collections().centres().findOne({ _id: doc.centreId, organizationId: doc.organizationId }),
    collections().users().findOne({ _id: doc.authorId, organizationId: doc.organizationId }),
    patientId ? collections().patients().findOne({ _id: patientId, organizationId: doc.organizationId }) : null,
    prescriberId ? collections().prescribers().findOne({ _id: prescriberId, organizationId: doc.organizationId }) : null,
  ]);
  if (!centre) throw new Error("Centre introuvable");
  return { org, centre, author, patient, prescriber };
}

/** Modèle PDF à partir des données vivantes (brouillon / aperçu). */
export function modelFromLive(
  e: LiveEntities,
  doc: { type: DocumentDoc["type"]; data: DocumentData },
  opts: { draft: boolean; audiometry: Audiometry | null },
): PdfModel {
  const common = {
    brand: pdfBrand(e.org),
    centre: pdfCentre(e.org, e.centre),
    author: {
      firstName: e.author?.firstName ?? "",
      lastName: e.author?.lastName ?? "",
      title: e.author?.title ?? "",
      signature: e.author?.signature ?? null,
    },
    patient: patientSnapshot(e.patient),
    prescriber: prescriberSnapshot(e.prescriber),
    showSignature: e.org.settings.documents.showSignature,
    defaultSalutation: e.org.settings.documents.defaultSalutation,
    draft: opts.draft,
  };
  return doc.type === "ADRESSAGE"
    ? { ...common, type: "ADRESSAGE", data: doc.data as AdressageData }
    : { ...common, type: "COMPTE_RENDU", data: doc.data as CompteRenduData, audiometry: opts.audiometry };
}

export function buildSnapshot(e: LiveEntities, audiometry: Audiometry | null): DocumentSnapshot {
  return {
    patient: patientSnapshot(e.patient) ?? { civility: "", firstName: "", lastName: "", birthDate: "" },
    prescriber: prescriberSnapshot(e.prescriber),
    author: { firstName: e.author?.firstName ?? "", lastName: e.author?.lastName ?? "", title: e.author?.title ?? "", signature: e.author?.signature ?? null },
    centreId: e.centre._id,
    audiometry,
  };
}

/**
 * Modèle PDF figé d'un document validé. L'adresse du destinataire peut être remplacée
 * (correction après refus du prestataire postal) sans toucher au contenu validé.
 */
export function modelFromSnapshot(
  org: OrganizationDoc,
  centre: CentreDoc,
  doc: DocumentDoc,
  overrides: { prescriberAddress?: PdfPrescriber["address"] } = {},
): PdfModel {
  const s = doc.snapshot!;
  const audiometry = s.audiometry ? audiometrySchema.safeParse(s.audiometry) : null;
  const prescriber = s.prescriber ? { ...s.prescriber, address: overrides.prescriberAddress ?? s.prescriber.address } : null;
  const common = {
    brand: pdfBrand(org),
    centre: pdfCentre(org, centre),
    author: s.author,
    patient: s.patient.lastName ? s.patient : null,
    prescriber,
    showSignature: org.settings.documents.showSignature,
    defaultSalutation: org.settings.documents.defaultSalutation,
    draft: false,
  };
  return doc.type === "ADRESSAGE"
    ? { ...common, type: "ADRESSAGE", data: doc.data as AdressageData }
    : { ...common, type: "COMPTE_RENDU", data: doc.data as CompteRenduData, audiometry: audiometry?.success ? audiometry.data : null };
}
