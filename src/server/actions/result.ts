import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/auth/permissions";
import { fr } from "@/lib/i18n/fr";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** Convertit toute erreur en message clair, sans fuite d'informations techniques. */
export function toActionError(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof ForbiddenError || err instanceof UserFacingError) return { ok: false, error: err.message };
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Certains champs sont invalides. Vérifiez le formulaire.", fieldErrors };
  }
  unstable_rethrow(err);
  console.error(err);
  return { ok: false, error: fr.common.unknownError };
}

export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (err) {
    return toActionError(err);
  }
}
