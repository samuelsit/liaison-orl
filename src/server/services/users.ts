import "server-only";
import { randomBytes } from "node:crypto";
import { symmetricEncrypt } from "better-auth/crypto";
import { getAuth } from "@/lib/auth/server";
import { collections } from "@/lib/db/collections";
import type { Role } from "@/lib/schemas/common";
import { formatPersonName } from "@/lib/text";

export interface NewUser {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  role: Role;
  organizationId: string;
  centreIds: string[];
  canSend?: boolean;
  signature?: string | null;
}

/**
 * Crée un utilisateur et son compte « mot de passe ». Sans mot de passe fourni, un mot
 * de passe aléatoire inconnu est posé : l'utilisateur choisira le sien via le lien d'invitation.
 */
export async function provisionUser(input: NewUser, password?: string): Promise<string> {
  const ctx = await getAuth().$context;
  const email = input.email.trim().toLowerCase();
  const existing = await collections().users().findOne({ email });
  if (existing) throw new Error(`Un utilisateur existe déjà avec l'adresse ${email}.`);
  const user = await ctx.internalAdapter.createUser({
    email,
    name: formatPersonName(input.firstName, input.lastName),
    emailVerified: true,
    role: input.role,
    organizationId: input.organizationId,
    centreIds: input.centreIds,
    firstName: input.firstName,
    lastName: input.lastName,
    title: input.title,
    active: true,
    canSend: input.canSend ?? false,
  }, { method: "admin" });
  const hash = await ctx.password.hash(password ?? randomBytes(24).toString("base64url"));
  await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: hash });
  if (input.signature) await collections().users().updateOne({ _id: user.id }, { $set: { signature: input.signature } });
  await collections()
    .users()
    .updateOne({ _id: user.id }, { $set: { preferences: { activeCentreId: input.centreIds[0] ?? null, learned: {}, favoritesFirst: true } } });
  return user.id;
}

/** Active la 2FA TOTP avec un secret connu (comptes de démonstration uniquement). */
export async function enableTotpWithSecret(userId: string, rawSecret: string): Promise<string[]> {
  const ctx = await getAuth().$context;
  const backupCodes = Array.from({ length: 10 }, () => {
    const c = randomBytes(8).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
  const secret = await symmetricEncrypt({ key: ctx.secretConfig, data: rawSecret });
  const encryptedCodes = await symmetricEncrypt({ key: ctx.secretConfig, data: JSON.stringify(backupCodes) });
  await ctx.adapter.create({
    model: "twoFactor",
    data: { secret, backupCodes: encryptedCodes, userId, verified: true },
  });
  await collections().users().updateOne({ _id: userId }, { $set: { twoFactorEnabled: true } });
  return backupCodes;
}
