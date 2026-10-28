import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { collections } from "@/lib/db/collections";
import { db } from "@/lib/db/client";
import type { CentreDoc, UserDoc } from "@/lib/db/types";
import { getAuth } from "@/lib/auth/server";
import type { UserContext } from "@/lib/auth/session";
import { centreInputSchema } from "@/lib/schemas/centre";
import { brandSchema, legalSchema, organizationSettingsSchema } from "@/lib/schemas/organization";
import { userInviteSchema } from "@/lib/schemas/user";
import { roleSchema } from "@/lib/schemas/common";
import { formatPersonName } from "@/lib/text";
import { UserFacingError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { invalidateOrganizationCache } from "@/server/repositories/organizations";
import { actor } from "./documents";
import { provisionUser } from "./users";

function assertAdmin(ctx: UserContext) {
  if (ctx.user.role !== "admin") throw new UserFacingError("Réservé aux administrateurs.");
}

/* ---------- Organisation et marque ---------- */

const orgUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: brandSchema,
  legal: legalSchema,
});

/** Normalise un logo : PNG, 600 px de haut maximum, marges transparentes rognées. */
export async function normalizeLogo(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new UserFacingError("Format de logo non pris en charge (PNG, JPEG ou WebP).");
  const input = Buffer.from(m[2]!, "base64");
  if (input.length > 4 * 1024 * 1024) throw new UserFacingError("Logo trop lourd (4 Mo maximum).");
  const out = await sharp(input).trim().resize({ height: 600, width: 1600, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}

export async function updateOrganization(ctx: UserContext, raw: unknown) {
  assertAdmin(ctx);
  const input = orgUpdateSchema.parse(raw);
  const logo = input.brand.logo === ctx.organization.brand.logo ? input.brand.logo : await normalizeLogo(input.brand.logo);
  await collections()
    .organizations()
    .updateOne({ _id: ctx.organization._id }, { $set: { name: input.name, brand: { ...input.brand, logo }, legal: input.legal, updatedAt: new Date() } });
  invalidateOrganizationCache();
  await audit(actor(ctx), "organization.update", "organization", ctx.organization._id);
}

export async function updateSettings(ctx: UserContext, raw: unknown) {
  assertAdmin(ctx);
  const settings = organizationSettingsSchema.parse(raw);
  if (settings.ai.commentMinLines > settings.ai.commentMaxLines) throw new UserFacingError("Le nombre minimal de lignes dépasse le maximum.");
  await collections().organizations().updateOne({ _id: ctx.organization._id }, { $set: { settings, updatedAt: new Date() } });
  invalidateOrganizationCache();
  await audit(actor(ctx), "settings.update", "organization", ctx.organization._id);
}

/* ---------- Centres ---------- */

export async function saveCentre(ctx: UserContext, id: string | null, raw: unknown): Promise<CentreDoc> {
  assertAdmin(ctx);
  const input = centreInputSchema.parse(raw);
  const now = new Date();
  if (id) {
    const existing = await collections().centres().findOne({ _id: id, organizationId: ctx.user.organizationId });
    if (!existing) throw new UserFacingError("Centre introuvable.");
    await collections().centres().updateOne({ _id: id }, { $set: { ...input, updatedAt: now } });
    await audit(actor(ctx), "centre.update", "centre", id);
    return { ...existing, ...input, updatedAt: now };
  }
  const centre: CentreDoc = { _id: randomUUID(), organizationId: ctx.user.organizationId, ...input, createdAt: now, updatedAt: now };
  await collections().centres().insertOne(centre);
  await audit(actor(ctx), "centre.create", "centre", centre._id);
  return centre;
}

/* ---------- Utilisateurs ---------- */

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  role: UserDoc["role"];
  centreIds: string[];
  active: boolean;
  canSend: boolean;
  twoFactorEnabled: boolean;
  twoFactorExempt: boolean;
  hasSignature: boolean;
  lastLogin: string | null;
}

export async function listUsers(ctx: UserContext): Promise<UserRow[]> {
  assertAdmin(ctx);
  const users = await collections().users().find({ organizationId: ctx.user.organizationId }).sort({ lastName: 1 }).toArray();
  const sessions = await db()
    .collection<{ userId: string; createdAt: Date }>("session")
    .aggregate<{ _id: string; last: Date }>([{ $match: { userId: { $in: users.map((u) => u._id) } } }, { $group: { _id: "$userId", last: { $max: "$createdAt" } } }])
    .toArray();
  const last = new Map(sessions.map((s) => [s._id, s.last]));
  return users.map((u) => ({
    id: u._id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    title: u.title,
    role: u.role,
    centreIds: u.centreIds ?? [],
    active: u.active !== false,
    canSend: Boolean(u.canSend),
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    twoFactorExempt: Boolean(u.twoFactorExempt),
    hasSignature: Boolean(u.signature),
    lastLogin: last.get(u._id)?.toISOString() ?? null,
  }));
}

async function sendInvitation(email: string) {
  await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/bienvenue" } });
}

export async function inviteUser(ctx: UserContext, raw: unknown) {
  assertAdmin(ctx);
  const input = userInviteSchema.parse(raw);
  const centreFilter = input.role === "admin" ? {} : { _id: { $in: input.centreIds } };
  const centreIds = (await collections().centres().find({ organizationId: ctx.user.organizationId, ...centreFilter }).toArray()).map((c) => c._id);
  if (centreIds.length === 0) throw new UserFacingError("Rattachez au moins un centre.");
  if (await collections().users().findOne({ email: input.email })) throw new UserFacingError("Un compte existe déjà avec cette adresse e-mail.");
  const id = await provisionUser({ ...input, organizationId: ctx.user.organizationId, centreIds });
  await sendInvitation(input.email);
  await audit(actor(ctx), "user.invite", "user", id, { role: input.role });
  return id;
}

export async function resendInvitation(ctx: UserContext, userId: string) {
  assertAdmin(ctx);
  const u = await collections().users().findOne({ _id: userId, organizationId: ctx.user.organizationId });
  if (!u) throw new UserFacingError("Utilisateur introuvable.");
  await sendInvitation(u.email);
}

const userUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  title: z.string().trim().max(80),
  role: roleSchema,
  centreIds: z.array(z.string()).max(200),
  canSend: z.boolean(),
});

export async function updateUser(ctx: UserContext, userId: string, raw: unknown) {
  assertAdmin(ctx);
  const input = userUpdateSchema.parse(raw);
  const u = await collections().users().findOne({ _id: userId, organizationId: ctx.user.organizationId });
  if (!u) throw new UserFacingError("Utilisateur introuvable.");
  if (u._id === ctx.user.id && input.role !== "admin") throw new UserFacingError("Vous ne pouvez pas retirer votre propre rôle d'administrateur.");
  const centreIds = (await collections().centres().find({ organizationId: ctx.user.organizationId, _id: { $in: input.centreIds } }).toArray()).map((c) => c._id);
  if (input.role !== "admin" && centreIds.length === 0) throw new UserFacingError("Rattachez au moins un centre.");
  // Une promotion au rôle d'administrateur rétablit la 2FA obligatoire.
  const promoted = u.role !== "admin" && input.role === "admin";
  await collections()
    .users()
    .updateOne(
      { _id: userId },
      { $set: { ...input, centreIds, name: formatPersonName(input.firstName, input.lastName), updatedAt: new Date(), ...(promoted ? { twoFactorExempt: false } : {}) } },
    );
  await audit(actor(ctx), "user.update", "user", userId, { role: input.role });
}

export async function setUserActive(ctx: UserContext, userId: string, active: boolean) {
  assertAdmin(ctx);
  if (userId === ctx.user.id) throw new UserFacingError("Vous ne pouvez pas désactiver votre propre compte.");
  const res = await collections().users().updateOne({ _id: userId, organizationId: ctx.user.organizationId }, { $set: { active, updatedAt: new Date() } });
  if (!res.matchedCount) throw new UserFacingError("Utilisateur introuvable.");
  if (!active) await db().collection("session").deleteMany({ userId });
  await audit(actor(ctx), active ? "user.reactivate" : "user.deactivate", "user", userId);
}

/** Réinitialise la double authentification d'un utilisateur (téléphone perdu). */
export async function resetTwoFactor(ctx: UserContext, userId: string) {
  assertAdmin(ctx);
  const u = await collections().users().findOne({ _id: userId, organizationId: ctx.user.organizationId });
  if (!u) throw new UserFacingError("Utilisateur introuvable.");
  await db().collection("twoFactor").deleteMany({ userId });
  await collections().users().updateOne({ _id: userId }, { $set: { twoFactorEnabled: false } });
  await db().collection("session").deleteMany({ userId });
  await audit(actor(ctx), "user.update", "user", userId, { twoFactorReset: true });
}

/**
 * Désactive la double authentification d'un utilisateur (secret TOTP et codes de secours supprimés)
 * et le dispense de la 2FA obligatoire des administrateurs ; `exempt = false` l'exige à nouveau.
 */
export async function setTwoFactorExempt(ctx: UserContext, userId: string, exempt: boolean) {
  assertAdmin(ctx);
  if (userId === ctx.user.id) throw new UserFacingError("Vous ne pouvez pas modifier votre propre double authentification depuis cet écran.");
  const u = await collections().users().findOne({ _id: userId, organizationId: ctx.user.organizationId });
  if (!u) throw new UserFacingError("Utilisateur introuvable.");
  if (exempt) await db().collection("twoFactor").deleteMany({ userId });
  await collections()
    .users()
    .updateOne({ _id: userId }, { $set: { twoFactorExempt: exempt, ...(exempt ? { twoFactorEnabled: false } : {}), updatedAt: new Date() } });
  await audit(actor(ctx), exempt ? "user.2fa_disabled" : "user.2fa_required", "user", userId);
}
