import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/permissions";
import { renderPreview } from "@/server/services/documents";
import { UserFacingError } from "@/server/actions/result";

export const runtime = "nodejs";

const bodySchema = z.object({
  data: z.unknown(),
  patientId: z.string().nullable(),
  prescriberId: z.string().nullable(),
});

/** Aperçu PDF exact du document à partir des valeurs en cours de saisie. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getUserContextOrThrow();
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const { buffer, info } = await renderPreview(ctx, id, body);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "X-Render-Info": JSON.stringify(info),
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Aperçu indisponible" }, { status: 500 });
  }
}
