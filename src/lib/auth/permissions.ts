import type { Role } from "@/lib/schemas/common";
import type { OrganizationSettings } from "@/lib/schemas/organization";

export type Action =
  | "document.create"
  | "document.edit"
  | "document.validate"
  | "document.send"
  | "document.delete"
  | "patient.edit"
  | "patient.delete"
  | "prescriber.edit"
  | "prescriber.archive"
  | "prescriber.merge"
  | "prescriber.import"
  | "admin.access";

export interface PermissionSubject {
  role: Role;
  canSend: boolean;
  centreIds: string[];
}

type PermissionSettings = Pick<OrganizationSettings, "permissions">;

/** Règles de droits (cahier des charges §4). Toujours évaluées côté serveur. */
export function can(user: PermissionSubject, action: Action, settings?: PermissionSettings): boolean {
  if (user.role === "admin") return true;
  const perms = settings?.permissions;
  switch (action) {
    case "document.create":
    case "document.edit":
    case "patient.edit":
      return true;
    case "prescriber.edit":
      return user.role === "assistant" || (perms?.audioprosCanEditDirectory ?? true);
    case "document.validate":
    case "document.delete":
      return user.role === "audioprothesiste";
    case "document.send":
      if (user.role === "audioprothesiste") return true;
      return user.canSend || (perms?.assistantsCanSend ?? false);
    case "patient.delete":
    case "prescriber.archive":
    case "prescriber.merge":
    case "prescriber.import":
    case "admin.access":
      return false;
  }
}

/** Un administrateur accède à tous les centres de son organisation. */
export function canAccessCentre(user: PermissionSubject, centreId: string): boolean {
  return user.role === "admin" || user.centreIds.includes(centreId);
}

export class ForbiddenError extends Error {
  constructor(message = "Vous n'avez pas les droits nécessaires pour cette action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(user: PermissionSubject, action: Action, settings?: PermissionSettings) {
  if (!can(user, action, settings)) throw new ForbiddenError();
}

export function assertCentre(user: PermissionSubject, centreId: string) {
  if (!canAccessCentre(user, centreId)) throw new ForbiddenError("Ce centre ne fait pas partie de vos centres.");
}

/** Lecteur d'une donnée réservée aux administrateurs (statistiques, journal d'audit). */
export interface AdminViewer {
  role: Role;
  organizationId: string;
}

export function assertAdminViewer(viewer: AdminViewer): string {
  if (viewer.role !== "admin") throw new ForbiddenError();
  return viewer.organizationId;
}
