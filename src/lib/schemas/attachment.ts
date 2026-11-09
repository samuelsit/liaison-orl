import type { Audiometry, BilanCondition } from "./audiometry";

export type ExtractionStatus = "pending" | "done" | "failed" | "manual";

/**
 * Fichier de bilan auditif joint à un compte rendu. Un compte rendu peut en porter
 * plusieurs (tonale, vocale, mesures avec appareils…) : chaque fichier garde sa propre
 * lecture ; la fusion vit sur le document (`documents.bilan`).
 */
export interface AttachmentDoc {
  _id: string;
  organizationId: string;
  centreId: string;
  documentId: string;
  patientId: string | null;
  kind: "bilan";
  fileKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  extraction: Audiometry | null;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
  /** Le modèle a reconnu une feuille entièrement mesurée avec appareils. */
  aidedSheet: boolean;
  /** Interprétation choisie par l'utilisateur (automatique par défaut). */
  condition: BilanCondition;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Vue d'une pièce jointe transmise au navigateur. */
export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
  aidedSheet: boolean;
  condition: BilanCondition;
  createdAt: string;
  extraction: Audiometry | null;
}

export const ACCEPTED_BILAN_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BILAN_BYTES = 4 * 1024 * 1024;
/** Nombre maximal de fichiers de bilan par compte rendu. */
export const MAX_BILANS_PER_DOCUMENT = 6;
