import { NextResponse } from "next/server";
import { getDefaultOrganization, getOrganization } from "@/server/repositories/organizations";

export const runtime = "nodejs";

/** Logo public de l'organisation (utilisé dans les e-mails, où les images en data URL sont bloquées). */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("o");
  const org = id ? await getOrganization(id) : await getDefaultOrganization();
  const m = org?.brand.logo ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(org.brand.logo) : null;
  if (!m) return NextResponse.json({ error: "Logo indisponible" }, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(m[2]!, "base64")), {
    headers: { "Content-Type": m[1]!, "Cache-Control": "public, max-age=3600" },
  });
}
