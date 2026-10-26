import { parseFrenchDate } from "@/lib/dates";

/** Initiales d'avatar (« JD ») : prénom puis nom, une lettre chacun ; « ? » si rien. */
export function personInitials(firstName: string, lastName: string): string {
  const letter = (s: string) => s.trim().match(/\p{L}|\d/u)?.[0]?.toLocaleUpperCase("fr-FR") ?? "";
  return `${letter(firstName)}${letter(lastName)}` || "?";
}

/**
 * Pré-remplissage d'une création de patient depuis une recherche infructueuse :
 * une date (JJ/MM/AAAA) devient la date de naissance ; sinon le dernier mot est le
 * prénom et le reste le nom (même règle que la sélection de patient de l'éditeur).
 */
export function patientPrefillFromQuery(query: string): { lastName?: string; firstName?: string; birthDate?: string } {
  const q = query.trim();
  if (!q) return {};
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(q)) {
    const iso = parseFrenchDate(q);
    return iso ? { birthDate: iso } : {};
  }
  const words = q.split(/\s+/);
  return words.length > 1 ? { lastName: words.slice(0, -1).join(" "), firstName: words.at(-1) } : { lastName: q };
}

/** Plage affichée d'une liste paginée (« 51–100 sur 245 »). Pages numérotées à partir de 1. */
export function pageRange(page: number, pageSize: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  return { page: current, pages, from, to, hasPrevious: current > 1, hasNext: current < pages };
}

/** Lettre sans accent et en minuscule ; les autres caractères deviennent des séparateurs. */
function foldChar(ch: string): string {
  const folded = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /^[a-z0-9@.]$/.test(folded) ? folded : " ";
}

/**
 * Plages [début, fin) du texte correspondant aux mots recherchés, au début d'un mot,
 * sans tenir compte des accents ni de la casse (même logique que la recherche serveur).
 * Les plages sont triées et fusionnées.
 */
export function highlightRanges(text: string, query: string): [number, number][] {
  const words = query
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0 || !text) return [];
  // Une lettre accentuée composée (é) reste un seul caractère : les index restent ceux du texte.
  const chars = Array.from(text);
  const offsets: number[] = [];
  let offset = 0;
  for (const ch of chars) {
    offsets.push(offset);
    offset += ch.length;
  }
  offsets.push(offset);
  const folded = chars.map(foldChar);
  const ranges: [number, number][] = [];
  for (let i = 0; i < folded.length; i++) {
    if (folded[i] === " " || (i > 0 && folded[i - 1] !== " ")) continue;
    for (const w of words) {
      const w2 = Array.from(w);
      if (w2.every((c, k) => folded[i + k] === c)) ranges.push([offsets[i]!, offsets[i + w2.length]!]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
