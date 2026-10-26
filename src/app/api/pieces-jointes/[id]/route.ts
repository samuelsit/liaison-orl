import { NextResponse } from "next/server";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/permissions";
import { getAttachmentForUser } from "@/server/services/attachments";
import { actor } from "@/server/services/documents";
import { storage } from "@/server/services/storage";
import { audit } from "@/server/audit";
import { UserFacingError } from "@/server/actions/result";

export const runtime = "nodejs";

/** Consultation du bilan joint (accès journalisé, jamais mis en cache). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getUserContextOrThrow();
    const { id } = await params;
    const att = await getAttachmentForUser(ctx, id);
    const data = await storage().get(att.fileKey);
    if (!data) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    await audit(actor(ctx), "attachment.view", "attachment", att._id);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
