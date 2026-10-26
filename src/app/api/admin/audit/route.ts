import { NextResponse } from "next/server";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { AUDIT_LABELS } from "@/lib/i18n/audit";
import { audit } from "@/server/audit";
import { actor } from "@/server/services/documents";
import { auditFilter } from "@/server/services/audit-query";
import { toCsv } from "@/server/services/stats";

export const runtime = "nodejs";

/** Export CSV du journal d'audit filtré (lui-même journalisé). */
export async function GET(request: Request) {
  const ctx = await getUserContextOrThrow().catch(() => null);
  if (!ctx || ctx.user.role !== "admin") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const f = auditFilter(ctx.user.organizationId, {
    userId: sp.get("utilisateur") ?? undefined,
    action: sp.get("action") ?? undefined,
    entityType: sp.get("entite") ?? undefined,
    from: sp.get("du") ?? undefined,
    to: sp.get("au") ?? undefined,
    q: sp.get("ref") ?? undefined,
  });
  const rows = await collections().auditLogs().find(f).sort({ at: -1 }).limit(50_000).toArray();
  await audit(actor(ctx), "audit.export", "auditLog", null, { rows: rows.length });
  const csv = toCsv(
    ["Date", "Utilisateur", "Action", "Code action", "Entité", "Identifiant", "Adresse IP", "Détails"],
    rows.map((r) => [r.at.toISOString(), r.userName ?? "Système / destinataire", AUDIT_LABELS[r.action] ?? r.action, r.action, r.entityType, r.entityId, r.ip, JSON.stringify(r.meta)]),
  );
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
