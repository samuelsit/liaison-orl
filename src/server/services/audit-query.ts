import "server-only";
import { assertAdminViewer, type AdminViewer } from "@/lib/auth/permissions";
import type { Filter } from "mongodb";
import { collections } from "@/lib/db/collections";
import type { AuditLogDoc } from "@/lib/db/types";

export interface AuditQuery {
  userId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
}

export function auditFilter(organizationId: string, q: AuditQuery): Filter<AuditLogDoc> {
  const f: Filter<AuditLogDoc> = { organizationId };
  if (q.userId) f.userId = q.userId;
  if (q.action) f.action = q.action.endsWith(".") ? { $regex: `^${q.action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } : q.action;
  if (q.entityType) f.entityType = q.entityType;
  if (q.from || q.to) {
    f.at = {};
    if (q.from) f.at.$gte = new Date(`${q.from}T00:00:00`);
    if (q.to) f.at.$lte = new Date(`${q.to}T23:59:59`);
  }
  if (q.q) f.entityId = q.q.trim();
  return f;
}

export async function queryAudit(viewer: AdminViewer, q: AuditQuery, pageSize = 50) {
  const f = auditFilter(assertAdminViewer(viewer), q);
  const page = Math.max(1, q.page ?? 1);
  const [items, total] = await Promise.all([
    collections().auditLogs().find(f).sort({ at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    collections().auditLogs().countDocuments(f),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
