import "server-only";
import type { Collection } from "mongodb";
import { db } from "./client";
import type {
  AiUsageDoc,
  AttachmentDoc,
  AuditLogDoc,
  CentreDoc,
  DispatchBatchDoc,
  DispatchDoc,
  DocumentDoc,
  OrganizationDoc,
  OutboxDoc,
  PatientDoc,
  PrescriberDoc,
  RateLimitDoc,
  SecureLinkDoc,
  UserDoc,
} from "./types";

export const COLLECTIONS = {
  organizations: "organizations",
  centres: "centres",
  users: "user",
  sessions: "session",
  accounts: "account",
  verifications: "verification",
  twoFactors: "twoFactor",
  prescribers: "prescribers",
  patients: "patients",
  documents: "documents",
  attachments: "attachments",
  dispatches: "dispatches",
  dispatchBatches: "dispatchBatches",
  auditLogs: "auditLogs",
  aiUsage: "aiUsage",
  secureLinks: "secureLinks",
  outbox: "outbox",
  rateLimits: "rateLimits",
  files: "files",
} as const;

function col<T extends { _id: string }>(name: string): Collection<T> {
  return db().collection<T>(name);
}

const COLS = {
  organizations: () => col<OrganizationDoc>(COLLECTIONS.organizations),
  centres: () => col<CentreDoc>(COLLECTIONS.centres),
  users: () => col<UserDoc>(COLLECTIONS.users),
  prescribers: () => col<PrescriberDoc>(COLLECTIONS.prescribers),
  patients: () => col<PatientDoc>(COLLECTIONS.patients),
  documents: () => col<DocumentDoc>(COLLECTIONS.documents),
  attachments: () => col<AttachmentDoc>(COLLECTIONS.attachments),
  dispatches: () => col<DispatchDoc>(COLLECTIONS.dispatches),
  dispatchBatches: () => col<DispatchBatchDoc>(COLLECTIONS.dispatchBatches),
  auditLogs: () => col<AuditLogDoc>(COLLECTIONS.auditLogs),
  aiUsage: () => col<AiUsageDoc>(COLLECTIONS.aiUsage),
  secureLinks: () => col<SecureLinkDoc>(COLLECTIONS.secureLinks),
  outbox: () => col<OutboxDoc>(COLLECTIONS.outbox),
  rateLimits: () => col<RateLimitDoc>(COLLECTIONS.rateLimits),
};

/** Accès typé aux collections : `collections().documents()`. */
export function collections() {
  return COLS;
}
