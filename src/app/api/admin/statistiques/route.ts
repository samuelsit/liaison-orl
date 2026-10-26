import { NextResponse } from "next/server";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { audit } from "@/server/audit";
import { actor } from "@/server/services/documents";
import { computeStats, toCsv } from "@/server/services/stats";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getUserContextOrThrow().catch(() => null);
  if (!ctx || ctx.user.role !== "admin") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const days = Math.min(730, Math.max(7, Number(new URL(request.url).searchParams.get("jours")) || 90));
  const s = await computeStats(ctx.user, days);
  await audit(actor(ctx), "stats.export", "organization", ctx.organization._id, { days });
  const csv = toCsv(
    ["Centre", "Adressages", "Comptes rendus", "Total", "Coût courrier (€)", "Erreurs d'envoi", "Appels IA", "Coût IA estimé ($)"],
    s.byCentre.map((r) => [r.label, r.adressage, r.compteRendu, r.total, (r.postalCostCents / 100).toFixed(2), r.errors, r.aiCalls, (r.aiCostMicroUsd / 1e6).toFixed(4)]),
  );
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="statistiques-${days}j.csv"`, "Cache-Control": "no-store" },
  });
}
