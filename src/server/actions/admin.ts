"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { audit } from "@/server/audit";
import { actor } from "@/server/services/documents";
import {
  inviteUser,
  resendInvitation,
  resetTwoFactor,
  saveCentre,
  setUserActive,
  updateOrganization,
  updateSettings,
  updateUser,
} from "@/server/services/admin";
import { runPurge, type PurgeReport } from "@/server/services/purge";
import { serviceStatus, type ServiceState } from "@/server/services/service-status";
import { listDuplicateGroups } from "@/server/services/prescribers";
import { runAction, UserFacingError, type ActionResult } from "./result";

async function adminCtx() {
  const ctx = await getUserContextOrThrow();
  if (ctx.user.role !== "admin") throw new UserFacingError("Réservé aux administrateurs.");
  return ctx;
}

export async function updateOrganizationAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await updateOrganization(await adminCtx(), input);
    revalidatePath("/", "layout");
    return undefined;
  }, "Organisation et marque enregistrées.");
}

export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await updateSettings(await adminCtx(), input);
    revalidatePath("/", "layout");
    return undefined;
  }, "Paramètres enregistrés.");
}

export async function saveCentreAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const c = await saveCentre(await adminCtx(), id ? z.string().parse(id) : null, input);
    revalidatePath("/admin/centres");
    revalidatePath("/", "layout");
    return { id: c._id };
  }, "Centre enregistré.");
}

export async function inviteUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const id = await inviteUser(await adminCtx(), input);
    revalidatePath("/admin/utilisateurs");
    return { id };
  }, "Invitation envoyée.");
}

export async function resendInvitationAction(userId: string): Promise<ActionResult> {
  return runAction(async () => {
    await resendInvitation(await adminCtx(), z.string().parse(userId));
    return undefined;
  }, "Invitation renvoyée.");
}

export async function updateUserAction(userId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await updateUser(await adminCtx(), z.string().parse(userId), input);
    revalidatePath("/admin/utilisateurs");
    return undefined;
  }, "Utilisateur enregistré.");
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await setUserActive(await adminCtx(), z.string().parse(userId), active);
    revalidatePath("/admin/utilisateurs");
    return undefined;
  }, active ? "Compte réactivé." : "Compte désactivé.");
}

export async function resetTwoFactorAction(userId: string): Promise<ActionResult> {
  return runAction(async () => {
    await resetTwoFactor(await adminCtx(), z.string().parse(userId));
    revalidatePath("/admin/utilisateurs");
    return undefined;
  }, "Double authentification réinitialisée : elle sera reconfigurée à la prochaine connexion.");
}

export async function purgeAction(dryRun: boolean): Promise<ActionResult<PurgeReport>> {
  return runAction(async () => {
    const ctx = await adminCtx();
    const report = await runPurge({ organizationId: ctx.user.organizationId, dryRun });
    if (!dryRun) await audit(actor(ctx), "purge.run", "organization", ctx.organization._id, { ...report });
    return report;
  });
}

export async function testServicesAction(): Promise<ActionResult<ServiceState[]>> {
  return runAction(async () => {
    await adminCtx();
    return serviceStatus({ test: true });
  });
}

export async function duplicateGroupsAction() {
  const ctx = await adminCtx();
  return listDuplicateGroups(ctx);
}
