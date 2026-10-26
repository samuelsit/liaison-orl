import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env, isProduction } from "@/lib/env";

/** Les tâches planifiées Vercel envoient « Authorization: Bearer <CRON_SECRET> ». */
export function isAuthorizedCron(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return !isProduction();
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
