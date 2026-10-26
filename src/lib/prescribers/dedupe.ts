import { normalizeSearch } from "@/lib/text";

export interface DedupeCandidate {
  _id: string;
  lastName: string;
  firstName: string;
  rpps: string;
  email: string;
  address: { postalCode: string };
}

/** Clés de rapprochement : RPPS, e-mail, ou nom + prénom + code postal. */
export function dedupeKeys(p: Omit<DedupeCandidate, "_id">): string[] {
  const keys: string[] = [];
  if (p.rpps) keys.push(`rpps:${p.rpps}`);
  if (p.email) keys.push(`email:${p.email.trim().toLowerCase()}`);
  const name = normalizeSearch(`${p.lastName} ${p.firstName}`).replace(/[\s-]/g, "");
  if (name) keys.push(`name:${name}:${p.address.postalCode.trim()}`);
  return keys;
}

/** Regroupe les fiches probablement en double (union-find sur les clés partagées). */
export function findDuplicateGroups<T extends DedupeCandidate>(items: T[]): T[][] {
  const parent = new Map<string, string>(items.map((i) => [i._id, i._id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const owner = new Map<string, string>();
  for (const item of items) {
    for (const key of dedupeKeys(item)) {
      const other = owner.get(key);
      if (other) parent.set(find(item._id), find(other));
      else owner.set(key, item._id);
    }
  }
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const root = find(item._id);
    groups.set(root, [...(groups.get(root) ?? []), item]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Fusionne des fiches : la fiche principale l'emporte, les champs vides sont complétés. */
export function mergeFields<T extends Record<string, unknown>>(master: T, others: T[], fields: (keyof T)[]): Partial<T> {
  const patch: Partial<T> = {};
  for (const field of fields) {
    const current = master[field];
    if (current === "" || current === null || current === undefined) {
      const found = others.map((o) => o[field]).find((v) => v !== "" && v !== null && v !== undefined);
      if (found !== undefined) patch[field] = found;
    }
  }
  return patch;
}
