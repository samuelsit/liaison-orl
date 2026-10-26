import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifySvixSignature } from "@/lib/dispatch/svix";
import { handleResendEvent } from "@/server/services/webhooks";

export const runtime = "nodejs";

/** Webhook Resend : statuts des e-mails (signature Svix vérifiée sur le corps brut). */
export async function POST(request: Request) {
  const secret = env().RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  const body = await request.text();
  const id = request.headers.get("svix-id");
  const valid = verifySvixSignature({ secret, id, timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature"), body });
  if (!valid) return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  try {
    const result = await handleResendEvent(JSON.parse(body), id!);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("Webhook Resend", err);
    return NextResponse.json({ error: "Erreur de traitement" }, { status: 500 });
  }
}
