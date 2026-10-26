import type { KeyboardEvent } from "react";

const ROW_LINK = "[data-slot=list-row] > a";

/** Liens principaux des lignes (ListRow) d'un conteneur, dans l'ordre d'affichage. */
export function rowLinks(container: ParentNode): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>(ROW_LINK));
}

/**
 * Navigation au clavier dans une liste de ListRow : ↓ / ↑ (ou j / k) passent à la ligne
 * suivante / précédente, Début / Fin vont aux extrémités. Actif seulement quand le focus est
 * sur le lien principal d'une ligne (les boutons d'action gardent leur comportement).
 */
export function onListKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const links = rowLinks(e.currentTarget);
  const from = links.indexOf(e.target as HTMLAnchorElement);
  if (from < 0) return;
  let to: number | null = null;
  if (e.key === "ArrowDown" || e.key === "j") to = Math.min(links.length - 1, from + 1);
  else if (e.key === "ArrowUp" || e.key === "k") to = Math.max(0, from - 1);
  else if (e.key === "Home") to = 0;
  else if (e.key === "End") to = links.length - 1;
  if (to === null) return;
  e.preventDefault();
  links[to]?.focus();
}

/** Identifiant de la fiche d'une ligne focalisée (`/patients/<id>`), ou null. */
export function focusedRowId(target: EventTarget, prefix: string): string | null {
  if (!(target instanceof HTMLAnchorElement) || !target.matches(ROW_LINK)) return null;
  const path = target.getAttribute("href") ?? "";
  return path.startsWith(prefix) ? decodeURIComponent(path.slice(prefix.length)) : null;
}
