import { z } from "zod";
import { idSchema, isoDateSchema, optionalIsoDate } from "./common";

export const DOCUMENT_TYPES = ["ADRESSAGE", "COMPTE_RENDU"] as const;
export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const DOCUMENT_STATUSES = ["BROUILLON", "VALIDE", "ENVOYE", "ERREUR"] as const;
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

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
  /** Inclure l'annexe audiométrique (page 2). */
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
  author: z.object({ firstName: z.string(), lastName: z.string(), title: z.string(), signature: z.string().nullable() }),
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
