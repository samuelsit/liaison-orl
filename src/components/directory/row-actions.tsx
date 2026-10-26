"use client";

import { RowActionButton, RowActionMenu, type RowAction } from "@/components/layout/list-row-actions";

/**
 * Actions d'une ligne d'annuaire : au pointeur fin, actions rapides (icônes avec infobulle)
 * puis menu ⋯ pour le reste, révélés au survol ou au focus de la ligne ; au toucher, un seul
 * menu ⋯ toujours visible qui regroupe tout. À placer dans `pinnedActions` de ListRow.
 */
export function DirectoryRowActions({ quick, menu, label }: { quick: RowAction[]; menu: RowAction[]; label: string }) {
  if (quick.length + menu.length === 0) return null;
  return (
    <>
      <div className="flex items-center gap-0.5 transition-opacity duration-150 pointer-coarse:hidden pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100 has-data-[state=open]:opacity-100!">
        {quick.map((a) => (
          <RowActionButton key={a.label} action={a} />
        ))}
        {menu.length > 0 ? <RowActionMenu actions={menu} label={label} /> : null}
      </div>
      <RowActionMenu actions={[...quick, ...menu]} label={label} className="hidden pointer-coarse:inline-flex" />
    </>
  );
}
