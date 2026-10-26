import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { runPurge } from "@/server/services/purge";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Tâche planifiée quotidienne : purge selon les durées de conservation. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const report = await runPurge();
  await audit(null, "purge.run", "organization", null, { ...report, automatic: true });
  return NextResponse.json(report);
}
