import type { ReactNode } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import type { DispatchListItem } from "@/server/services/hydrate";
import { DispatchRows } from "./dispatch-rows";

/**
 * Liste d'envois sans habillage (composant serveur) : à placer dans une SectionCard `flush`
 * ou un ListRowContainer. Les lignes en erreur proposent « Renvoyer » (avec confirmation)
 * quand l'utilisateur a le droit d'envoi, déterminé ici depuis la session si `canSend` est omis.
 * `empty=""` sans `emptyState` n'affiche rien.
 */
export async function DispatchList({
  items,
  empty = "",
  emptyState,
  canSend,
  grouped = false,
}: {
  items: DispatchListItem[];
  empty?: string;
  /** État vide complet (icône, description, action) ; remplace `empty`. */
  emptyState?: ReactNode;
  canSend?: boolean;
  /** Sous-titres par période (« Aujourd'hui », « Cette semaine », « Plus ancien »). */
  grouped?: boolean;
}) {
  if (items.length === 0) return emptyState ?? (empty ? <EmptyState title={empty} /> : null);
  let allowed = canSend;
  if (allowed === undefined) {
    const ctx = await getUserContext();
    allowed = can(ctx.user, "document.send", ctx.organization.settings);
  }
  return <DispatchRows items={items} canSend={allowed} grouped={grouped} />;
}
