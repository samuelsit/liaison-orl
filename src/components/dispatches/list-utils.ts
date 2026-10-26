import { dateGroup, type DateGroup } from "@/lib/dates";

/**
 * Groupe une liste triée (plus récent d'abord) par période : « Aujourd'hui », « Cette semaine »,
 * « Plus ancien ». L'ordre des éléments est conservé ; une période n'apparaît qu'une fois.
 */
export function groupByDate<T>(items: T[], dateOf: (item: T) => string | Date, now = new Date()): { key: DateGroup; items: T[] }[] {
  const groups = new Map<DateGroup, T[]>();
  for (const item of items) {
    const key = dateGroup(dateOf(item), now);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].map(([key, list]) => ({ key, items: list }));
}

/** Pas de chargement des listes (« Afficher 50 de plus »). */
export const PAGE_STEP = 50;
export const PAGE_MAX = 500;

/** Taille de liste demandée par le paramètre `n` (50 par défaut, par pas de 50, plafonnée à 500). */
export function pageSize(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= PAGE_STEP) return PAGE_STEP;
  return Math.min(PAGE_MAX, Math.ceil(n / PAGE_STEP) * PAGE_STEP);
}
