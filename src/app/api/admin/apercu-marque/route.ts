import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { centreDisplayName } from "@/lib/brand";
import { pdfBrand } from "@/server/services/pdf-model";
import { brandSchema } from "@/lib/schemas/organization";
import { renderPdf } from "@/lib/pdf/render";
import { sampleModel } from "@/lib/pdf/sample";

export const runtime = "nodejs";

/** Aperçu en direct des PDF avec la marque en cours de modification (non enregistrée). */
export async function POST(request: Request) {
  const ctx = await getUserContextOrThrow().catch(() => null);
  if (!ctx || ctx.user.role !== "admin") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const parsed = z.object({ brand: brandSchema, type: z.enum(["ADRESSAGE", "COMPTE_RENDU"]) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Valeurs invalides" }, { status: 400 });
  const { brand, type } = parsed.data;
  const c = ctx.activeCentre;
  const { buffer } = await renderPdf(
    sampleModel(
      type,
      pdfBrand({ brand, legal: ctx.organization.legal }),
      { name: c.name, displayName: centreDisplayName(brand.name, c.name), address: c.address, phone: c.phone, email: c.email, senderAddress: c.senderAddress },
      ctx.organization.settings.documents.defaultSalutation,
      false,
    ),
  );
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
