import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { saveDraft } from "@/server/services/documents";

export const runtime = "nodejs";

const schema = z.object({
  data: z.unknown(),
  patientId: z.string().nullable(),
  prescriberId: z.string().nullable(),
  aiFields: z.array(z.string().max(80)).max(50),
});

/** Sauvegarde de secours envoyée par `navigator.sendBeacon` à la fermeture de l'onglet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getUserContextOrThrow();
    const { id } = await params;
    const body = schema.parse(JSON.parse(await request.text()));
    const res = await saveDraft(ctx, id, body);
    return NextResponse.json({ updatedAt: res.updatedAt.toISOString() });
  } catch {
    return NextResponse.json({ error: "Sauvegarde impossible" }, { status: 400 });
  }
}
