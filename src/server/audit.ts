import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { collections } from "@/lib/db/collections";
import type { AuditLogDoc } from "@/lib/db/types";

export type AuditAction =
  | "auth.login"
  | "auth.2fa_enabled"
  | "document.create"
  | "document.update"
  | "document.view"
  | "document.validate"
  | "document.reopen"
  | "document.delete"
  | "document.pdf_download"
  | "dispatch.prepare"
  | "dispatch.confirm"
  | "dispatch.cancel"
  | "dispatch.retry"
  | "dispatch.status"
  | "secure_link.access"
  | "secure_link.denied"
  | "patient.create"
  | "patient.update"
  | "patient.view"
  | "patient.delete"
  | "prescriber.create"
  | "prescriber.update"
  | "prescriber.archive"
  | "prescriber.restore"
  | "prescriber.merge"
  | "prescriber.import"
  | "attachment.upload"
  | "attachment.view"
  | "attachment.extract"
  | "attachment.confirm"
  | "ai.generate"
  | "user.invite"
  | "user.update"
  | "user.deactivate"
  | "user.reactivate"
  | "user.profile"
  | "centre.create"
  | "centre.update"
  | "organization.update"
  | "settings.update"
  | "purge.run"
  | "audit.export"
  | "stats.export";

interface AuditActor {
  id: string;
  fullName: string;
  organizationId: string;
}

async function requestInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = fwd ? fwd.split(",")[0]!.trim() : h.get("x-real-ip");
    return { ip: ip ?? null, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Journal d'audit en ajout seul : aucune fonction de modification n'est exposée. */
export async function audit(
  actor: AuditActor | null,
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  meta: AuditLogDoc["meta"] = {},
  organizationId?: string | null,
) {
  const { ip, userAgent } = await requestInfo();
  await collections().auditLogs().insertOne({
    _id: randomUUID(),
    organizationId: actor?.organizationId ?? organizationId ?? null,
    userId: actor?.id ?? null,
    userName: actor?.fullName ?? null,
    action,
    entityType,
    entityId,
    at: new Date(),
    ip,
    userAgent,
    meta,
  });
}
