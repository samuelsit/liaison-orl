import { NextResponse } from "next/server";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { canAccessCentre, ForbiddenError } from "@/lib/auth/permissions";
import { collections } from "@/lib/db/collections";
import { storage } from "@/server/services/storage";
import { audit } from "@/server/audit";
import { actor } from "@/server/services/documents";

export const runtime = "nodejs";

/** PDF exact transmis au prestataire postal (version avec page d'accompagnement) ou preuve d'envoi. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getUserContextOrThrow();
    const { id } = await params;
    const d = await collections().dispatches().findOne({ _id: id, organizationId: ctx.user.organizationId });
    if (!d || !canAccessCentre(ctx.user, d.centreId)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    const which = new URL(request.url).searchParams.get("type") === "preuve" ? d.proofKey : d.pdfKey;
    const pdf = which ? await storage().get(which) : null;
    if (!pdf) return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });
    await audit(actor(ctx), "document.pdf_download", "dispatch", d._id);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": "inline" } });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
