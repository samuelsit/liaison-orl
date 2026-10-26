/** Normalisation pour la recherche : minuscules, sans accents ni ponctuation. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Expression régulière « chaque mot commence par » pour l'autocomplétion. */
export function prefixWordsRegex(query: string): RegExp | null {
  const words = normalizeSearch(query).split(" ").filter(Boolean).slice(0, 5);
  if (words.length === 0) return null;
  return new RegExp(words.map((w) => `(?=.*(?:^|\\s)${escapeRegex(w)})`).join(""), "i");
}

export function initials(firstName: string, lastName: string): string {
  const f = firstName.trim()[0];
  const l = lastName.trim()[0];
  return [f, l].filter(Boolean).map((c) => `${c!.toUpperCase()}.`).join(" ");
}

export function upperName(lastName: string): string {
  return lastName.trim().toLocaleUpperCase("fr-FR");
}

export function capitalizeName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("fr-FR"));
}

export function formatPersonName(firstName: string, lastName: string): string {
  return [capitalizeName(firstName), upperName(lastName)].filter(Boolean).join(" ");
}
