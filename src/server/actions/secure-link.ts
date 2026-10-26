"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { collections } from "@/lib/db/collections";
import { audit } from "@/server/audit";
import { hit } from "@/server/rate-limit";
import { applyDispatchUpdate } from "@/server/services/dispatch-status";
import { signAccess, verifySecondFactor } from "@/server/services/secure-links";

export type UnlockState = { error: string | null; unlocked: boolean };

export const accessCookieName = async (linkId: string) => `lorl_acces_${linkId.slice(0, 16)}`;

/** Déverrouillage du lien sécurisé par le second facteur (date de naissance ou code). */
export async function unlockSecureLinkAction(token: string, _prev: UnlockState, form: FormData): Promise<UnlockState> {
  const value = z.string().max(40).parse(form.get("valeur") ?? "");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "inconnue";
  if (!(await hit(`lien-ip:${ip}`, 30, 600))) return { error: "Trop de tentatives depuis cette connexion. Réessayez plus tard.", unlocked: false };
  const res = await verifySecondFactor(z.string().parse(token), value);
  if (!res.ok) {
    const link = await collections().secureLinks().findOne({ _id: (await import("@/server/services/secure-links")).hashToken(token) });
    if (link) await audit(null, "secure_link.denied", "secure_link", link.dispatchId, { reason: res.reason }, link.organizationId);
    const msg =
      res.reason === "expired"
        ? "Ce lien a expiré. Demandez un nouvel envoi au centre."
        : res.reason === "locked"
          ? "Trop d'essais incorrects : le lien est bloqué pendant 15 minutes."
          : res.reason === "invalid"
            ? "Ce lien n'est pas valide."
            : `Valeur incorrecte. Il vous reste ${res.remaining} essai${res.remaining === 1 ? "" : "s"}.`;
    return { error: msg, unlocked: false };
  }
  const link = res.link;
  const exp = Date.now() + 15 * 60_000;
  (await cookies()).set(await accessCookieName(link._id), `${exp}.${signAccess(link._id, exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: `/l/${token}`,
    maxAge: 15 * 60,
  });
  await collections().secureLinks().updateOne({ _id: link._id }, { $push: { accessLog: { at: new Date(), ip } } });
  await applyDispatchUpdate(link.dispatchId, { status: "opened", type: "link.opened", source: "app", detail: "Document consulté par le destinataire" });
  await audit(null, "secure_link.access", "secure_link", link.dispatchId, {}, link.organizationId);
  return { error: null, unlocked: true };
}
