import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./server";
import { collections } from "@/lib/db/collections";
import type { Role } from "@/lib/schemas/common";
import { ensureIndexes } from "@/lib/db/indexes";
import { getOrganization, listCentres } from "@/server/repositories/organizations";
import type { CentreDoc, OrganizationDoc } from "@/lib/db/types";
import { ForbiddenError } from "./permissions";
import { loginHref, REQUEST_PATH_HEADER } from "@/lib/navigation";

export const ACTIVE_CENTRE_COOKIE = "lorl_centre";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  role: Role;
  organizationId: string;
  centreIds: string[];
  canSend: boolean;
  twoFactorEnabled: boolean;
  /** 2FA obligatoire : administrateur non dispensé. */
  twoFactorRequired: boolean;
  hasSignature: boolean;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  void ensureIndexes().catch((err) => console.error("Index MongoDB", err));
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = await collections().users().findOne({ _id: session.user.id });
  if (!u || u.active === false) return null;
  return {
    id: u._id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`.trim() || u.name,
    title: u.title,
    role: u.role,
    organizationId: u.organizationId,
    centreIds: u.centreIds ?? [],
    canSend: Boolean(u.canSend),
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    twoFactorRequired: u.role === "admin" && !u.twoFactorExempt,
    hasSignature: Boolean(u.signature),
  };
});

/** Exige un utilisateur connecté ; impose la configuration 2FA aux administrateurs non dispensés. */
export async function requireUser(opts: { allowPending2fa?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  // Connexion puis retour à la page demandée (chemin relatif vérifié par loginHref).
  if (!user) redirect(loginHref((await headers()).get(REQUEST_PATH_HEADER)));
  if (user.twoFactorRequired && !user.twoFactorEnabled && !opts.allowPending2fa) redirect("/securite/2fa");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Variante pour les actions serveur et routes : lève une erreur au lieu de rediriger. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ForbiddenError("Votre session a expiré. Reconnectez-vous.");
  if (user.twoFactorRequired && !user.twoFactorEnabled) {
    throw new ForbiddenError("Activez la double authentification pour continuer.");
  }
  return user;
}

export async function requireAdminOrThrow(): Promise<SessionUser> {
  const user = await requireUserOrThrow();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}

export interface UserContext {
  user: SessionUser;
  organization: OrganizationDoc;
  centres: CentreDoc[];
  activeCentre: CentreDoc;
}

/** Centres accessibles par l'utilisateur (tous pour un administrateur). */
export async function accessibleCentres(user: SessionUser): Promise<CentreDoc[]> {
  const all = await listCentres(user.organizationId);
  return user.role === "admin" ? all : all.filter((c) => user.centreIds.includes(c._id));
}

export const getUserContext = cache(async (): Promise<UserContext> => {
  const user = await requireUser();
  return buildContext(user);
});

/**
 * Contexte d'une page d'administration. Chaque page l'appelle elle-même : un layout
 * n'est pas une frontière d'autorisation (rendu partiel des segments par Next.js).
 */
export async function getAdminContext(): Promise<UserContext> {
  const ctx = await getUserContext();
  if (ctx.user.role !== "admin") redirect("/");
  return ctx;
}

export async function getUserContextOrThrow(): Promise<UserContext> {
  const user = await requireUserOrThrow();
  return buildContext(user);
}

async function buildContext(user: SessionUser): Promise<UserContext> {
  const organization = await getOrganization(user.organizationId);
  if (!organization) throw new Error("Organisation introuvable");
  const centres = await accessibleCentres(user);
  if (centres.length === 0) throw new ForbiddenError("Aucun centre actif ne vous est rattaché. Contactez votre administrateur.");
  const cookieValue = (await cookies()).get(ACTIVE_CENTRE_COOKIE)?.value;
  let activeCentre = centres.find((c) => c._id === cookieValue);
  if (!activeCentre) {
    const prefs = await collections().users().findOne({ _id: user.id }, { projection: { preferences: 1 } });
    activeCentre = centres.find((c) => c._id === prefs?.preferences?.activeCentreId) ?? centres[0]!;
  }
  return { user, organization, centres, activeCentre };
}
