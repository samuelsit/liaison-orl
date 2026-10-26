/**
 * Pseudonymisation des textes envoyés à l'IA : les éléments d'identité (nom, prénom,
 * date de naissance du patient, nom du prescripteur) sont remplacés par des jetons,
 * puis réinjectés dans la réponse.
 */
export interface IdentityEntity {
  token: string;
  /** Valeurs à masquer (toutes les variantes connues). */
  values: string[];
  /** Valeur réinjectée à la place du jeton. */
  replacement: string;
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function accentInsensitive(s: string) {
  const map: Record<string, string> = { a: "aàâä", e: "eéèêë", i: "iîï", o: "oôö", u: "uùûü", c: "cç", y: "yÿ" };
  return [...s]
    .map((ch) => {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const set = map[base];
      return set ? `[${set}${set.toUpperCase()}]` : escape(ch);
    })
    .join("");
}

/** Variantes d'une date ISO (17/10/1946, 17-10-1946, 17.10.46, 1946-10-17, 17 octobre 1946). */
export function dateVariants(iso: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return [];
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const day = String(Number(d));
  return [
    `${d}/${mo}/${y}`,
    `${day}/${Number(mo)}/${y}`,
    `${d}-${mo}-${y}`,
    `${d}.${mo}.${y}`,
    `${d}/${mo}/${y.slice(2)}`,
    iso,
    `${day} ${months[Number(mo) - 1]} ${y}`,
    `${day === "1" ? "1er" : day} ${months[Number(mo) - 1]} ${y}`,
  ];
}

export function buildEntities(input: {
  patient?: { civility: string; firstName: string; lastName: string; birthDate: string } | null;
  prescriber?: { civility: string; firstName: string; lastName: string } | null;
}): IdentityEntity[] {
  const entities: IdentityEntity[] = [];
  const p = input.patient;
  if (p) {
    const full = `${p.firstName} ${p.lastName}`.trim();
    entities.push({
      token: "[PATIENT]",
      values: [`${p.civility} ${full}`, `${p.civility} ${p.lastName}`, `${p.lastName} ${p.firstName}`, full, p.lastName, p.firstName].filter((v) => v.trim().length >= 2),
      replacement: `${p.civility} ${p.lastName.toLocaleUpperCase("fr-FR")}`,
    });
    if (p.birthDate) entities.push({ token: "[DATE_NAISSANCE]", values: dateVariants(p.birthDate), replacement: p.birthDate.split("-").reverse().join("/") });
  }
  const d = input.prescriber;
  if (d && d.lastName) {
    entities.push({
      token: "[MEDECIN]",
      values: [`${d.civility} ${d.firstName} ${d.lastName}`, `${d.civility} ${d.lastName}`, `${d.firstName} ${d.lastName}`, d.lastName].filter((v) => v.trim().length >= 2),
      replacement: `${d.civility} ${d.lastName.toLocaleUpperCase("fr-FR")}`,
    });
  }
  return entities;
}

export function pseudonymize(text: string, entities: IdentityEntity[]): string {
  let out = text;
  for (const e of entities) {
    const values = [...new Set(e.values)].sort((a, b) => b.length - a.length);
    for (const v of values) {
      const re = new RegExp(`(?<![\\p{L}\\d])${accentInsensitive(v)}(?![\\p{L}\\d])`, "giu");
      out = out.replace(re, e.token);
    }
  }
  return out;
}

export function reidentify(text: string, entities: IdentityEntity[]): string {
  let out = text;
  for (const e of entities) out = out.split(e.token).join(e.replacement);
  return out;
}

/** Vérifie qu'aucune valeur d'identité ne subsiste (garde-fou avant l'appel). */
export function containsIdentity(text: string, entities: IdentityEntity[]): boolean {
  return entities.some((e) =>
    e.values.some((v) => v.length >= 3 && new RegExp(`(?<![\\p{L}\\d])${accentInsensitive(v)}(?![\\p{L}\\d])`, "iu").test(text)),
  );
}
