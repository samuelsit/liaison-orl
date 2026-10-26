import { NextResponse } from "next/server";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/permissions";
import { getDocumentForUser, actor, renderPreview } from "@/server/services/documents";
import { storage } from "@/server/services/storage";
import { audit } from "@/server/audit";
import { UserFacingError } from "@/server/actions/result";

export const runtime = "nodejs";

/** Téléchargement du PDF validé (ou rendu du brouillon). Accès journalisé. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getUserContextOrThrow();
    const { id } = await params;
    const doc = await getDocumentForUser(ctx, id);
    const download = new URL(request.url).searchParams.get("telecharger") === "1";
    let buffer: Buffer | null = null;
    if (doc.pdfKey && doc.status !== "BROUILLON") buffer = await storage().get(doc.pdfKey);
    if (!buffer) buffer = (await renderPreview(ctx, id, { data: doc.data, patientId: doc.patientId, prescriberId: doc.prescriberId })).buffer;
    await audit(actor(ctx), "document.pdf_download", "document", doc._id, { version: doc.version });
    const name = `${doc.type === "ADRESSAGE" ? "courrier-adressage" : "compte-rendu-appareillage"}-v${doc.version || "brouillon"}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "PDF indisponible" }, { status: 500 });
  }
}
