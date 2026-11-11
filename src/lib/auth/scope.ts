import type { Role } from "@/lib/schemas/common";

/** Valeur du cookie de centre actif pour la vue « Tous les centres » (administrateurs). */
export const ALL_CENTRES = "tous";

/** La vue « Tous les centres » est réservée aux administrateurs d'une organisation à plusieurs centres. */
export function canViewAllCentres(user: { role: Role }, centreCount: number): boolean {
  return user.role === "admin" && centreCount > 1;
}

/** Complète un contexte avec la vue demandée (« Tous les centres » seulement si autorisée). */
export function withScope<T extends { user: { role: Role }; centres: { _id: string }[]; activeCentre: { _id: string } }>(
  base: T,
  wantsAll: boolean,
): T & { allCentres: boolean; scopeCentreIds: string[] } {
  const allCentres = wantsAll && canViewAllCentres(base.user, base.centres.length);
  return { ...base, allCentres, scopeCentreIds: allCentres ? base.centres.map((c) => c._id) : [base.activeCentre._id] };
}
