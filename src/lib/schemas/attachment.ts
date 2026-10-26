import { audiometrySchema } from "./audiometry";
import type { z } from "zod";

export type ExtractionStatus = "pending" | "done" | "failed" | "manual";

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
  extraction: z.infer<typeof audiometrySchema> | null;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
  confirmed: boolean;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ACCEPTED_BILAN_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BILAN_BYTES = 4 * 1024 * 1024;
