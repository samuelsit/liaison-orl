import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName } from "@/server/actions/secure-link";
import { findLink, verifyAccess } from "@/server/services/secure-links";
import { storage } from "@/server/services/storage";

export const runtime = "nodejs";

/** PDF accessible uniquement après le second facteur (cookie signé de 15 minutes). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await findLink(token);
  if (!link || link.revoked || link.expiresAt < new Date()) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
  if (!verifyAccess(link._id, (await cookies()).get(await accessCookieName(link._id))?.value)) {
    return NextResponse.redirect(new URL(`/l/${token}`, request.url));
  }
  const pdf = await storage().get(link.pdfKey);
  if (!pdf) return NextResponse.json({ error: "Document indisponible" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("telecharger") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="document.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
