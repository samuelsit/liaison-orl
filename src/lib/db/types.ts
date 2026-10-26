import type { Organization } from "@/lib/schemas/organization";
import type { Centre } from "@/lib/schemas/centre";
import type { Prescriber } from "@/lib/schemas/prescriber";
import type { Patient } from "@/lib/schemas/patient";
import type { AppUserDoc } from "@/lib/schemas/user";
import type { DocumentDoc } from "@/lib/schemas/document";
import type { AttachmentDoc } from "@/lib/schemas/attachment";
import type { DispatchDoc } from "@/lib/schemas/dispatch";

export type OrganizationDoc = Organization;
export type CentreDoc = Centre;
export type PrescriberDoc = Prescriber;
export type PatientDoc = Patient;
export type UserDoc = AppUserDoc;
export type { DocumentDoc, AttachmentDoc, DispatchDoc };

export interface AuditLogDoc {
  _id: string;
  organizationId: string | null;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  at: Date;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, string | number | boolean | null>;
}

export type AiKind = "extraction" | "comment" | "motif" | "dictation" | "email";

export interface AiUsageDoc {
  _id: string;
  organizationId: string;
  centreId: string | null;
  userId: string | null;
  kind: AiKind;
  model: string;
  mock: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costMicroUsd: number;
  success: boolean;
  at: Date;
}

export interface SecureLinkDoc {
  /** Empreinte SHA-256 du jeton (le jeton en clair n'est jamais stocké). */
  _id: string;
  organizationId: string;
  dispatchId: string;
  documentId: string;
  pdfKey: string;
  secondFactor: "birthdate" | "code";
  /** Empreinte du second facteur (date de naissance normalisée ou code). */
  factorHash: string;
  expiresAt: Date;
  attempts: number;
  lockedUntil: Date | null;
  /** Échecs cumulés sur la durée de vie du lien (révocation au-delà du plafond). */
  failures?: number;
  accessLog: { at: Date; ip: string | null }[];
  revoked: boolean;
  createdAt: Date;
}

export interface OutboxDoc {
  _id: string;
  organizationId: string | null;
  kind: "magic-link" | "invitation" | "document" | "access-code" | "reset-password" | "other";
  from: string;
  to: string[];
  cc: string[];
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; size: number }[];
  externalId: string;
  createdAt: Date;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  resetAt: Date;
}

export interface DispatchBatchDoc {
  _id: string;
  organizationId: string;
  createdBy: string;
  documentIds: string[];
  createdAt: Date;
}
