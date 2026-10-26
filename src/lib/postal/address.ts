import type { PostalAddress } from "@/lib/schemas/common";

const MAX_LINE = 38;

export interface AddressRecipient {
  civility: string;
  firstName: string;
  lastName: string;
  practiceName?: string;
  address: PostalAddress;
}

export interface FormattedAddress {
  lines: string[];
  errors: string[];
  warnings: string[];
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Lignes 4 à 6 (norme La Poste) : majuscules, sans accents ni ponctuation. */
const normalizeLower = (s: string) =>
  stripAccents(s)
    .toUpperCase()
    .replace(/[.,;:'’"\-_/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const clean = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

function truncate(line: string, warnings: string[], label: string): string {
  if (line.length <= MAX_LINE) return line;
  warnings.push(`${label} dépasse 38 caractères : elle sera abrégée.`);
  return line.slice(0, MAX_LINE).trimEnd();
}

export function isFrance(country: string): boolean {
  const c = normalizeLower(country || "FRANCE");
  return c === "FRANCE" || c === "FR";
}

/**
 * Bloc adresse destinataire conforme aux règles La Poste reprises par Pingen :
 * 3 à 6 lignes, 38 caractères maximum, code postal à 5 chiffres + VILLE en majuscules,
 * dernière ligne = pays.
 */
export function formatRecipientAddress(r: AddressRecipient): FormattedAddress {
  const errors: string[] = [];
  const warnings: string[] = [];
  const a = r.address;
  const name = clean([r.civility, r.firstName, r.lastName.toLocaleUpperCase("fr-FR")].filter(Boolean).join(" "));
  if (!r.lastName.trim()) errors.push("Le nom du destinataire est manquant.");
  if (!a.line1.trim()) errors.push("L'adresse (numéro et voie) est manquante.");
  if (!a.city.trim()) errors.push("La ville est manquante.");
  const france = isFrance(a.country);
  const postalCode = a.postalCode.replace(/\s/g, "");
  if (france && !/^\d{5}$/.test(postalCode)) errors.push("Le code postal doit comporter 5 chiffres.");
  if (!france && !postalCode) warnings.push("Code postal absent pour une adresse à l'étranger.");

  const lines = [truncate(name, warnings, "La ligne du nom")];
  const complement = clean(r.practiceName ?? "");
  if (complement) lines.push(truncate(complement, warnings, "Le nom du cabinet"));
  const line2 = normalizeLower(a.line2);
  const line1 = normalizeLower(a.line1);
  if (line2) lines.push(truncate(line2, warnings, "Le complément d'adresse"));
  if (line1) lines.push(truncate(line1, warnings, "La ligne de voie"));
  lines.push(truncate(normalizeLower(`${postalCode} ${a.city}`), warnings, "La ligne code postal / ville"));
  lines.push(france ? "FRANCE" : normalizeLower(a.country));

  // Au-delà de 6 lignes, on retire d'abord le cabinet (complément facultatif).
  if (lines.length > 6 && complement) lines.splice(1, 1);
  if (lines.length > 6) errors.push("L'adresse comporte trop de lignes (6 au maximum).");
  return { lines, errors, warnings };
}

/** Bloc expéditeur (le centre). */
export function formatSenderAddress(name: string, a: PostalAddress): string[] {
  return [clean(name), clean(a.line1), clean(a.line2), clean(`${a.postalCode} ${a.city}`), isFrance(a.country) ? "" : clean(a.country).toUpperCase()].filter(Boolean);
}
