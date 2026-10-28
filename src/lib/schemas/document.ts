import { z } from "zod";
import { idSchema, isoDateSchema, optionalIsoDate } from "./common";

export const DOCUMENT_TYPES = ["ADRESSAGE", "COMPTE_RENDU"] as const;
export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const DOCUMENT_STATUSES = ["BROUILLON", "VALIDE", "ENVOYE", "ERREUR"] as const;
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/**
 * Seul le compte rendu d'appareillage s'envoie (e-mail, courrier). Le courrier d'adressage
 * s'imprime ou se télécharge : il passe de BROUILLON à VALIDÉ et n'est jamais ENVOYÉ.
 */
export const SENDABLE_DOCUMENT_TYPES = ["COMPTE_RENDU"] as const satisfies readonly DocumentType[];

export function isSendableType(type: DocumentType): boolean {
  return (SENDABLE_DOCUMENT_TYPES as readonly DocumentType[]).includes(type);
}

/** Statuts possibles d'un type de document (filtres, compteurs). */
export function statusesFor(type: DocumentType | null): readonly DocumentStatus[] {
  return type && !isSendableType(type) ? (["BROUILLON", "VALIDE"] as const) : DOCUMENT_STATUSES;
}

export const NOT_SENDABLE_MESSAGE = "Le courrier d'adressage ne s'envoie pas : imprimez-le ou téléchargez le PDF.";

/* ---------- Courrier d'adressage (schéma v1) ---------- */

export const adressageDataSchema = z.object({
  schemaVersion: z.literal(1),
  date: isoDateSchema,
  /** Formule d'appel ; vide = formule du prescripteur ou formule par défaut. */
  salutation: z.string().trim().max(60).default(""),
  exams: z.object({
    conduits: z.boolean().default(false),
    bilan: z.boolean().default(false),
    autre: z.boolean().default(false),
  }),
  autreText: z.string().max(600).default(""),
  /** Notes brutes (dictée) servant à la reformulation par l'IA. */
  motifNotes: z.string().max(1000).default(""),
});
export type AdressageData = z.infer<typeof adressageDataSchema>;

/* ---------- Compte rendu d'appareillage (schéma v1) ---------- */

export const DEGREES = ["legere", "moyenne", "severe", "profonde"] as const;
export const EARS = ["droite", "gauche", "deux"] as const;
export const DEVICE_TYPES = ["intra", "ecouteur_deporte", "contour"] as const;
export const DEVICE_BRANDS = ["signia", "starkey", "resound", "autre"] as const;
export const DEVICE_CLASSES = ["cmu", "1", "2"] as const;
export const MOTIVATIONS = ["peu", "moderee", "active"] as const;
export const HANDLINGS = ["oui", "non", "a_travailler"] as const;

export const compteRenduDataSchema = z.object({
  schemaVersion: z.literal(1),
  reportDate: isoDateSchema,
  prescriptionDate: optionalIsoDate.default(""),
  degree: z.enum(DEGREES).nullable().default(null),
  ears: z.enum(EARS).nullable().default(null),
  deviceType: z.enum(DEVICE_TYPES).nullable().default(null),
  deviceBrand: z.enum(DEVICE_BRANDS).nullable().default(null),
  deviceBrandOther: z.string().trim().max(40).default(""),
  deviceModel: z.string().trim().max(80).default(""),
  pricePerDevice: z.number().min(0).max(100000).nullable().default(null),
  deviceClass: z.enum(DEVICE_CLASSES).nullable().default(null),
  rechargeable: z.boolean().nullable().default(null),
  customEarmolds: z.boolean().nullable().default(null),
  wearDuration: z.string().trim().max(40).default(""),
  wearHoursPerDay: z.number().min(0).max(24).nullable().default(null),
  motivation: z.enum(MOTIVATIONS).nullable().default(null),
  handling: z.enum(HANDLINGS).nullable().default(null),
  comments: z.string().max(2500).default(""),
  /** Bilan auditif joint (pièce jointe) dont sont issues les mesures. */
  attachmentId: idSchema.nullable().default(null),
  /** Règle de calcul affichée pour le degré de surdité. */
  degreeRule: z.string().max(400).nullable().default(null),
  /** Inclure l'audiogramme redessiné et le gain prothétique dans le compte rendu. */
  includeAnnex: z.boolean().default(true),
});
export type CompteRenduData = z.infer<typeof compteRenduDataSchema>;

export type DocumentData = AdressageData | CompteRenduData;

export function dataSchemaFor(type: DocumentType) {
  return type === "ADRESSAGE" ? adressageDataSchema : compteRenduDataSchema;
}

/** Instantané figé à la validation pour garantir la reproductibilité du PDF. */
export const snapshotSchema = z.object({
  patient: z.object({
    civility: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    birthDate: z.string(),
  }),
  prescriber: z
    .object({
      civility: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      salutation: z.string(),
      practiceName: z.string(),
      email: z.string(),
      address: z.object({
        line1: z.string(),
        line2: z.string(),
        postalCode: z.string(),
        city: z.string(),
        country: z.string(),
      }),
    })
    .nullable(),
  author: z.object({ firstName: z.string(), lastName: z.string(), title: z.string(), signature: z.string().nullable(), rpps: z.string().optional() }),
  centreId: idSchema,
  /** Mesures audiométriques confirmées au moment de la validation (compte rendu). */
  audiometry: z.unknown().nullable(),
});
export type DocumentSnapshot = z.infer<typeof snapshotSchema>;

export interface DocumentDoc {
  _id: string;
  organizationId: string;
  centreId: string;
  type: DocumentType;
  status: DocumentStatus;
  patientId: string | null;
  prescriberId: string | null;
  authorId: string;
  data: DocumentData;
  /** Chemins des champs suggérés par l'IA et non encore validés. */
  aiFields: string[];
  version: number;
  pdfKey: string | null;
  snapshot: DocumentSnapshot | null;
  validatedAt: Date | null;
  validatedBy: string | null;
  sentAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
