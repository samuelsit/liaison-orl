import { NextResponse } from "next/server";
import { postalProvider } from "@/server/services/postal";
import { handlePingenEvent } from "@/server/services/webhooks";

export const runtime = "nodejs";

/** Webhook Pingen : HMAC-SHA256 hexadécimal du corps brut dans l'en-tête « Signature ». */
export async function POST(request: Request) {
  const body = await request.text();
  if (!postalProvider().verifyWebhook(body, request.headers.get("signature"))) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }
  try {
    const result = await handlePingenEvent(JSON.parse(body));
    return NextResponse.json({ result });
  } catch (err) {
    console.error("Webhook Pingen", err);
    return NextResponse.json({ error: "Erreur de traitement" }, { status: 500 });
  }
}
