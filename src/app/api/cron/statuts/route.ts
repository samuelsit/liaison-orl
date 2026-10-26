import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron";
import { refreshMockDispatches } from "@/server/services/dispatch-status";
import { pollPostalDispatches } from "@/server/services/webhooks";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Tâche planifiée : suivi des courriers et évolution des envois simulés. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const [postal] = await Promise.all([pollPostalDispatches(), refreshMockDispatches()]);
  return NextResponse.json({ postal });
}
