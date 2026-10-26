import "server-only";
import { collections } from "@/lib/db/collections";
import { rateLimitDisabled } from "@/lib/env";

/**
 * Limitation de débit partagée entre instances (stockée en base, expiration automatique).
 * Renvoie false si la limite est atteinte.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (rateLimitDisabled()) return true;
  const now = new Date();
  const res = await collections()
    .rateLimits()
    .findOneAndUpdate(
      { _id: key, resetAt: { $gt: now } },
      { $inc: { count: 1 } },
      { returnDocument: "after" },
    );
  if (res) return res.count <= limit;
  await collections()
    .rateLimits()
    .updateOne({ _id: key }, { $set: { count: 1, resetAt: new Date(now.getTime() + windowSeconds * 1000) } }, { upsert: true });
  return true;
}
