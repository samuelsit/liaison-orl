"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { requireUserOrThrow } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { userProfileUpdateSchema } from "@/lib/schemas/user";
import { formatPersonName } from "@/lib/text";
import { audit } from "@/server/audit";
import { runAction, UserFacingError, type ActionResult } from "./result";

const actorOf = (u: Awaited<ReturnType<typeof requireUserOrThrow>>) => ({ id: u.id, fullName: u.fullName, organizationId: u.organizationId });

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    const p = userProfileUpdateSchema.parse(input);
    await collections()
      .users()
      .updateOne({ _id: user.id }, { $set: { ...p, name: formatPersonName(p.firstName, p.lastName), updatedAt: new Date() } });
    await audit(actorOf(user), "user.profile", "user", user.id);
    revalidatePath("/", "layout");
    return undefined;
  }, "Profil enregistré.");
}

/** Signature scannée : rognée, fond conservé, 600 × 200 px maximum, PNG. */
export async function updateSignatureAction(dataUrl: string | null): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    let signature: string | null = null;
    if (dataUrl) {
      const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(z.string().max(6_000_000).parse(dataUrl));
      if (!m) throw new UserFacingError("Format non pris en charge (PNG, JPEG ou WebP).");
      const out = await sharp(Buffer.from(m[2]!, "base64")).rotate().trim({ threshold: 30 }).resize({ width: 600, height: 200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
      signature = `data:image/png;base64,${out.toString("base64")}`;
    }
    await collections().users().updateOne({ _id: user.id }, { $set: { signature, updatedAt: new Date() } });
    await audit(actorOf(user), "user.profile", "user", user.id, { signature: Boolean(signature) });
    return undefined;
  }, dataUrl ? "Signature enregistrée." : "Signature supprimée.");
}
