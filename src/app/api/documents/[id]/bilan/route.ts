import { NextResponse } from "next/server";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/permissions";
import { MAX_BILAN_BYTES } from "@/lib/schemas/attachment";
import { toAttachmentView, uploadBilan } from "@/server/services/attachments";
import { UserFacingError } from "@/server/actions/result";

export const runtime = "nodejs";

/** Dépôt du bilan auditif (PDF ou image), multipart/form-data, champ « fichier ». */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getUserContextOrThrow();
    const { id } = await params;
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_BILAN_BYTES + 64_000) return NextResponse.json({ error: "Fichier trop volumineux (4 Mo maximum)." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("fichier");
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    const att = await uploadBilan(ctx, id, { name: file.name, data: Buffer.from(await file.arrayBuffer()) });
    return NextResponse.json(toAttachmentView(att));
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Le dépôt du bilan a échoué." }, { status: 500 });
  }
}
