"use client";

import { RowActionButton, RowActionMenu, type RowAction } from "@/components/layout/list-row-actions";
import { fr } from "@/lib/i18n/fr";

/**
 * Actions d'une ligne (à passer en `pinnedActions` de ListRow) :
 * - pointeur fin : petite barre flottante (actions principales en icônes + menu ⋯ pour les
 *   autres) qui apparaît au survol ou au focus de la ligne, par-dessus le statut et la date :
 *   aucune largeur n'est réservée, les titres ne sont pas tronqués dans les cartes étroites ;
 * - toucher : un seul menu ⋯ toujours visible, avec toutes les actions.
 */
export function RowActionsCluster({ primary, more = [], label = fr.common.moreActions }: { primary: RowAction[]; more?: RowAction[]; label?: string }) {
  const all = [...primary, ...more];
  if (all.length === 0) return null;
  return (
    <>
      <div
        data-slot="row-actions-toolbar"
        className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-sm transition-opacity duration-150 pointer-coarse:hidden pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100 pointer-fine:has-data-[state=open]:opacity-100"
      >
        {primary.map((a) => (
          <RowActionButton key={a.label} action={a} />
        ))}
        {more.length > 0 ? <RowActionMenu actions={more} label={label} /> : null}
      </div>
      <RowActionMenu actions={all} label={label} className="hidden pointer-coarse:inline-flex" />
    </>
  );
}
