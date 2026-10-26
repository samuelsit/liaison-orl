import { normalizeSearch } from "@/lib/text";
import { prescriberInputSchema, type PrescriberInput } from "@/lib/schemas/prescriber";

/** Colonnes reconnues (en-têtes insensibles à la casse et aux accents). */
const HEADER_ALIASES: Record<string, string[]> = {
  civility: ["civilite", "civ", "titre"],
  lastName: ["nom", "nom de famille", "last name", "lastname"],
  firstName: ["prenom", "first name", "firstname"],
  specialty: ["specialite", "specialty"],
  rpps: ["rpps", "n rpps", "numero rpps"],
  practiceName: ["cabinet", "etablissement", "structure", "cabinet etablissement"],
  line1: ["adresse", "adresse 1", "adresse1", "adresse ligne 1", "rue"],
  line2: ["adresse 2", "adresse2", "complement", "complement d adresse", "adresse ligne 2"],
  postalCode: ["code postal", "cp", "code_postal", "codepostal"],
  city: ["ville", "commune", "localite"],
  country: ["pays"],
  email: ["email", "e-mail", "mail", "courriel"],
  phone: ["telephone", "tel", "tél", "phone"],
  preferredChannel: ["canal", "canal prefere", "envoi"],
  salutation: ["formule", "formule d appel", "salutation"],
  notes: ["notes", "remarques", "commentaire"],
};

export function mapHeader(header: string): string | null {
  const h = normalizeSearch(header.replace(/[_']/g, " "));
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => normalizeSearch(a.replace(/[_']/g, " ")) === h) || normalizeSearch(field) === h) return field;
  }
  return null;
}

function parseCivility(v: string): PrescriberInput["civility"] {
  const s = normalizeSearch(v);
  if (s.startsWith("pr")) return "Pr";
  if (s === "mme" || s.startsWith("madame")) return "Mme";
  if (s === "m" || s === "m." || s.startsWith("monsieur")) return "M.";
  return "Dr";
}

function parseChannel(v: string): PrescriberInput["preferredChannel"] {
  const s = normalizeSearch(v);
  if (s.includes("deux") || s.includes("both") || (s.includes("mail") && s.includes("courrier"))) return "both";
  if (s.includes("courrier") || s.includes("poste") || s.includes("postal")) return "courrier";
  return "email";
}

export interface CsvRowResult {
  row: number;
  ok: boolean;
  value?: PrescriberInput;
  error?: string;
}

/** Convertit des lignes CSV (objets indexés par en-tête) en fiches validées. */
export function parsePrescriberRows(rows: Record<string, string>[]): CsvRowResult[] {
  return rows.map((raw, i) => {
    const mapped: Record<string, string> = {};
    for (const [header, value] of Object.entries(raw)) {
      const field = mapHeader(header);
      if (field && typeof value === "string") mapped[field] = value.trim();
    }
    const candidate = {
      civility: parseCivility(mapped.civility ?? ""),
      lastName: mapped.lastName ?? "",
      firstName: mapped.firstName ?? "",
      specialty: mapped.specialty || "ORL",
      rpps: (mapped.rpps ?? "").replace(/\s/g, ""),
      practiceName: mapped.practiceName ?? "",
      address: {
        line1: mapped.line1 ?? "",
        line2: mapped.line2 ?? "",
        postalCode: (mapped.postalCode ?? "").replace(/\s/g, ""),
        city: mapped.city ?? "",
        country: (mapped.country || "FRANCE").toUpperCase(),
      },
      email: (mapped.email ?? "").toLowerCase(),
      phone: mapped.phone ?? "",
      preferredChannel: parseChannel(mapped.preferredChannel ?? ""),
      salutation: mapped.salutation ?? "",
      notes: mapped.notes ?? "",
      centreIds: [],
    };
    const parsed = prescriberInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return { row: i + 2, ok: false, error: parsed.error.issues.map((iss) => iss.message).join(" ; ") };
    }
    return { row: i + 2, ok: true, value: parsed.data };
  });
}

export const CSV_TEMPLATE_HEADERS = [
  "civilite",
  "nom",
  "prenom",
  "specialite",
  "rpps",
  "cabinet",
  "adresse1",
  "adresse2",
  "code_postal",
  "ville",
  "pays",
  "email",
  "telephone",
  "canal",
  "formule",
  "notes",
];
