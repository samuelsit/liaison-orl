import { ERROR_STATUSES } from "@/lib/schemas/dispatch";
import type { DispatchListItem, DocumentListItem } from "@/server/services/hydrate";

/** Un document et ses envois (erreurs d'abord, puis du plus récent au plus ancien). */
export interface ActivityEntry {
  doc: DocumentListItem;
  dispatches: DispatchListItem[];
}

/** Documents d'un même mois (« Octobre 2026 »). */
export interface ActivityGroup {
  key: string;
  label: string;
  entries: ActivityEntry[];
}

const monthKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Europe/Paris" });
const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });

const time = (iso: string) => new Date(iso).getTime();
const isError = (d: DispatchListItem) => ERROR_STATUSES.includes(d.status);

/** Envois triés : erreurs en tête, puis du plus récent au plus ancien. */
export function sortDispatches(items: DispatchListItem[]): DispatchListItem[] {
  return [...items].sort((a, b) => Number(isError(b)) - Number(isError(a)) || time(b.updatedAt) - time(a.updatedAt));
}

/**
 * Fil d'activité d'une fiche (patient ou prescripteur) : documents groupés par mois
 * (dernière modification, heure de Paris), chacun avec ses envois. Les envois dont le
 * document n'est pas dans la liste chargée sont renvoyés à part (« Autres envois »).
 */
export function buildActivity(
  docs: DocumentListItem[],
  dispatches: DispatchListItem[],
): { groups: ActivityGroup[]; orphans: DispatchListItem[] } {
  const byDoc = new Map<string, DispatchListItem[]>();
  for (const d of dispatches) byDoc.set(d.documentId, [...(byDoc.get(d.documentId) ?? []), d]);

  const groups: ActivityGroup[] = [];
  for (const doc of [...docs].sort((a, b) => time(b.updatedAt) - time(a.updatedAt))) {
    const date = new Date(doc.updatedAt);
    const key = monthKey.format(date).slice(0, 7);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const label = monthLabel.format(date);
      group = { key, label: label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1), entries: [] };
      groups.push(group);
    }
    group.entries.push({ doc, dispatches: sortDispatches(byDoc.get(doc.id) ?? []) });
  }

  const docIds = new Set(docs.map((d) => d.id));
  const orphans = sortDispatches(dispatches.filter((d) => !docIds.has(d.documentId)));
  return { groups, orphans };
}

/** Indicateurs d'une fiche prescripteur, calculés sur les listes déjà chargées. */
export function activityStats(docs: DocumentListItem[], dispatches: DispatchListItem[]) {
  const patients = new Set(docs.map((d) => d.patientName).filter((n): n is string => Boolean(n)));
  const last = dispatches.reduce<string | null>((acc, d) => (!acc || time(d.createdAt) > time(acc) ? d.createdAt : acc), null);
  return { documents: docs.length, patients: patients.size, lastDispatchAt: last };
}
