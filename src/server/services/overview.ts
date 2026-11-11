import "server-only";
import { collections } from "@/lib/db/collections";
import { parisMonthStart } from "@/lib/dates";
import { ERROR_STATUSES } from "@/lib/schemas/dispatch";

export interface CentreOverviewRow {
  centreId: string;
  /** Brouillons (adressages et comptes rendus), quel que soit l'auteur. */
  drafts: number;
  /** Comptes rendus validés, prêts à envoyer. */
  toSend: number;
  /** Envois en erreur non acquittés. */
  errors: number;
  /** Documents créés depuis le 1er du mois (heure de Paris). */
  month: number;
}

/**
 * Vue d'ensemble « Par centre » de l'accueil (administrateurs, vue « Tous les centres ») :
 * mêmes règles que les sections de l'accueil, une ligne par centre (zéros compris), dans l'ordre reçu.
 */
export async function centreOverview(
  organizationId: string,
  centreIds: string[],
  now = new Date(),
): Promise<CentreOverviewRow[]> {
  const monthStart = parisMonthStart(now);
  const [docs, errors] = await Promise.all([
    collections()
      .documents()
      .aggregate<{ _id: string; drafts: number; toSend: number; month: number }>([
        { $match: { organizationId, centreId: { $in: centreIds } } },
        {
          $group: {
            _id: "$centreId",
            drafts: { $sum: { $cond: [{ $eq: ["$status", "BROUILLON"] }, 1, 0] } },
            toSend: {
              $sum: { $cond: [{ $and: [{ $eq: ["$status", "VALIDE"] }, { $eq: ["$type", "COMPTE_RENDU"] }] }, 1, 0] },
            },
            month: { $sum: { $cond: [{ $gte: ["$createdAt", monthStart] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
    collections()
      .dispatches()
      .aggregate<{ _id: string; n: number }>([
        {
          $match: {
            organizationId,
            centreId: { $in: centreIds },
            status: { $in: [...ERROR_STATUSES] },
            acknowledged: { $ne: true },
          },
        },
        { $group: { _id: "$centreId", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const byDoc = new Map(docs.map((d) => [d._id, d]));
  const byErr = new Map(errors.map((e) => [e._id, e.n]));
  return centreIds.map((centreId) => {
    const d = byDoc.get(centreId);
    return {
      centreId,
      drafts: d?.drafts ?? 0,
      toSend: d?.toSend ?? 0,
      errors: byErr.get(centreId) ?? 0,
      month: d?.month ?? 0,
    };
  });
}
