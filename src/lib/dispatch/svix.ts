import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vérification des webhooks Resend (format Svix) : HMAC-SHA256 base64 de
 * `${id}.${timestamp}.${corps}` avec la clé décodée de `whsec_…`, tolérance 5 minutes.
 */
export function verifySvixSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number;
}): boolean {
  const { secret, id, timestamp, signature, body } = input;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
