import type { PostalAddress } from "@/lib/schemas/common";

/** Norme NF Z10-011 / La Poste : 6 lignes au plus, 38 caractères au plus par ligne. */
export const MAX_ADDRESS_LINES = 6;
export const MAX_ADDRESS_CHARS = 38;

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

export interface AddressFormatOptions {
  /** Largeur imprimée d'une ligne en mm (police et corps réels du PDF). */
  measureMm?: (line: string) => number;
  /** Largeur disponible dans la zone d'adresse (mm). */
  maxWidthMm?: number;
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Lignes 4 à 6 (norme La Poste) : majuscules, sans accents ni ponctuation. */
const normalizeUpper = (s: string) =>
  stripAccents(s)
    .toUpperCase()
    .replace(/[.,;:'’"\-_/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const clean = (s: string) =>
  s
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Abréviations normalisées La Poste (types de voie, titres, compléments), appliquées
 * dans cet ordre uniquement quand une ligne est trop longue.
 */
const ABBREVIATIONS: [string, string][] = [
  ["BOULEVARD", "BD"],
  ["AVENUE", "AV"],
  ["ALLEE", "ALL"],
  ["CHEMIN", "CHE"],
  ["CHAUSSEE", "CHS"],
  ["FAUBOURG", "FG"],
  ["IMPASSE", "IMP"],
  ["LOTISSEMENT", "LOT"],
  ["PASSAGE", "PAS"],
  ["PLACE", "PL"],
  ["QUARTIER", "QUA"],
  ["RESIDENCE", "RES"],
  ["ROND POINT", "RPT"],
  ["ROUTE", "RTE"],
  ["SQUARE", "SQ"],
  ["HAMEAU", "HAM"],
  ["ZONE INDUSTRIELLE", "ZI"],
  ["ZONE ARTISANALE", "ZA"],
  ["CENTRE COMMERCIAL", "CCAL"],
  ["BATIMENT", "BAT"],
  ["ESCALIER", "ESC"],
  ["ETAGE", "ETG"],
  ["APPARTEMENT", "APP"],
  ["IMMEUBLE", "IMM"],
  ["DOCTEUR", "DR"],
  ["PROFESSEUR", "PR"],
  ["GENERAL", "GAL"],
  ["MARECHAL", "MAL"],
  ["PRESIDENT", "PDT"],
  ["COMMANDANT", "CDT"],
  ["CAPITAINE", "CAP"],
  ["LIEUTENANT", "LT"],
  ["COLONEL", "COL"],
  ["SAINTE", "STE"],
  ["SAINT", "ST"],
  ["NOTRE DAME", "ND"],
  ["GRANDE", "GDE"],
  ["GRAND", "GD"],
];

export function isFrance(country: string): boolean {
  const c = normalizeUpper(country || "FRANCE");
  return c === "FRANCE" || c === "FR";
}

/**
 * Bloc adresse destinataire conforme à la norme NF Z10-011 reprise par Pingen :
 * 6 lignes au plus, 38 caractères au plus, code postal à 5 chiffres + VILLE en
 * majuscules, dernière ligne = pays. Une ligne trop longue est abrégée selon la
 * norme ; si elle ne tient toujours pas, l'envoi postal est bloqué (jamais de
 * troncature ni de réduction de la police).
 */
export function formatRecipientAddress(r: AddressRecipient, opts: AddressFormatOptions = {}): FormattedAddress {
  const errors: string[] = [];
  const warnings: string[] = [];
  const a = r.address;
  const fits = (line: string) =>
    line.length <= MAX_ADDRESS_CHARS &&
    (!opts.measureMm || !opts.maxWidthMm || opts.measureMm(line) <= opts.maxWidthMm);

  /** Abrège une ligne normalisée (majuscules) jusqu'à ce qu'elle tienne. */
  const shorten = (line: string, label: string): string => {
    if (fits(line)) return line;
    let out = line;
    for (const [word, abbr] of ABBREVIATIONS) {
      out = out.replace(new RegExp(`\\b${word}\\b`, "g"), abbr);
      if (fits(out)) {
        warnings.push(`${label} a été abrégée selon la norme postale (« ${out} »).`);
        return out;
      }
    }
    errors.push(
      `${label} est trop longue pour la fenêtre de l'enveloppe, même abrégée (« ${line} ») : raccourcissez-la dans la fiche du prescripteur.`,
    );
    return out;
  };

  if (!r.lastName.trim()) errors.push("Le nom du destinataire est manquant.");
  if (!a.line1.trim()) errors.push("L'adresse (numéro et voie) est manquante.");
  if (!a.city.trim()) errors.push("La ville est manquante.");
  const france = isFrance(a.country);
  const postalCode = a.postalCode.replace(/\s/g, "");
  if (france && !/^\d{5}$/.test(postalCode)) errors.push("Le code postal doit comporter 5 chiffres.");
  if (!france && !postalCode) warnings.push("Code postal absent pour une adresse à l'étranger.");

  // Ligne 1 : civilité + prénom + NOM ; si trop longue, initiale du prénom, puis sans prénom.
  const lastName = clean(r.lastName).toLocaleUpperCase("fr-FR");
  let name = clean([r.civility, r.firstName, lastName].filter(Boolean).join(" "));
  if (!fits(name) && r.firstName.trim()) {
    const shorter = [
      clean([r.civility, `${r.firstName.trim()[0]!.toUpperCase()}.`, lastName].filter(Boolean).join(" ")),
      clean([r.civility, lastName].filter(Boolean).join(" ")),
    ];
    name = shorter.find(fits) ?? shorter[1]!;
    if (fits(name)) warnings.push(`Le nom du destinataire a été abrégé pour la fenêtre de l'enveloppe (« ${name} »).`);
  }
  if (!fits(name)) errors.push(`Le nom du destinataire est trop long pour la fenêtre de l'enveloppe (« ${name} »).`);
  const lines = [name];

  // Ligne 2 : cabinet ou établissement (facultatif) ; retiré s'il ne tient pas.
  let practice = clean(r.practiceName ?? "");
  if (practice && !fits(practice)) {
    const upper = normalizeUpper(practice);
    const abbreviated = ABBREVIATIONS.reduce((s, [w, ab]) => s.replace(new RegExp(`\\b${w}\\b`, "g"), ab), upper);
    if (fits(abbreviated)) {
      warnings.push(`Le nom du cabinet a été abrégé pour la fenêtre de l'enveloppe (« ${abbreviated} »).`);
      practice = abbreviated;
    } else {
      warnings.push(
        "Le nom du cabinet est trop long pour la fenêtre de l'enveloppe : il n'est pas imprimé dans l'adresse.",
      );
      practice = "";
    }
  }
  if (practice) lines.push(practice);

  // Lignes 3 à 6 : complément, numéro et voie, code postal + VILLE, pays.
  const line2 = normalizeUpper(a.line2);
  const line1 = normalizeUpper(a.line1);
  if (line2) lines.push(shorten(line2, "Le complément d'adresse"));
  if (line1) lines.push(shorten(line1, "La ligne de voie"));
  lines.push(shorten(normalizeUpper(`${postalCode} ${a.city}`), "La ligne code postal / ville"));
  lines.push(france ? "FRANCE" : normalizeUpper(a.country));

  // Au-delà de 6 lignes, on retire d'abord le cabinet (complément facultatif).
  if (lines.length > MAX_ADDRESS_LINES && practice) {
    lines.splice(1, 1);
    warnings.push("L'adresse comporte trop de lignes : le nom du cabinet n'est pas imprimé dans l'adresse.");
  }
  if (lines.length > MAX_ADDRESS_LINES)
    errors.push(`L'adresse comporte trop de lignes (${MAX_ADDRESS_LINES} au maximum).`);
  return { lines, errors, warnings };
}

/** Bloc expéditeur (le centre). */
export function formatSenderAddress(name: string, a: PostalAddress): string[] {
  return [
    clean(name),
    clean(a.line1),
    clean(a.line2),
    clean(`${a.postalCode} ${a.city}`),
    isFrance(a.country) ? "" : clean(a.country).toUpperCase(),
  ].filter(Boolean);
}
