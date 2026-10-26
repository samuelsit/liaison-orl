const TZ = "Europe/Paris";

/** Date du jour au format AAAA-MM-JJ (fuseau de Paris). */
export function todayIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

/** « 17/10/2026 » à partir d'une date ISO AAAA-MM-JJ. */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** « 17 octobre 2026 ». */
export function formatIsoDateLong(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(d);
}

export function formatRelative(date: Date | string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 45) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return formatDateTime(d);
}

const toDate = (date: Date | string) => (typeof date === "string" ? new Date(date) : date);

/** Numéro du jour calendaire (fuseau de Paris), pour comparer « aujourd'hui », « hier »… */
function parisDayIndex(d: Date): number {
  const [y, m, day] = todayIso(d).split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/**
 * Date courte des listes (une seule règle par colonne) : relative sous 7 jours
 * (« à l'instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 jours »),
 * sinon absolue courte (« 9 oct. », avec l'année si ce n'est pas l'année en cours).
 * La date complète va dans l'attribut `title` (cf. `formatFullDateTime`).
 */
export function formatShortDate(date: Date | string, now = new Date()): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "";
  const seconds = (d.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(seconds);
  const days = parisDayIndex(d) - parisDayIndex(now);
  if (abs < 45) return "à l'instant";
  const short = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto", style: "short" });
  if (abs < 3600) return short.format(Math.round(seconds / 60) || Math.sign(seconds), "minute");
  if (days === 0) return short.format(Math.round(seconds / 3600) || Math.sign(seconds), "hour");
  if (Math.abs(days) < 7) return new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" }).format(days, "day");
  const sameYear = todayIso(d).slice(0, 4) === todayIso(now).slice(0, 4);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "short", year: sameYear ? undefined : "numeric" }).format(d);
}

/** « jeudi 9 octobre 2026 à 23:25 » : infobulle des dates courtes. */
export function formatFullDateTime(date: Date | string): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(d);
}

export type DateGroup = "today" | "week" | "older";

/**
 * Groupe de date pour les sous-titres de liste : aujourd'hui, cette semaine
 * (depuis lundi, hors aujourd'hui), plus ancien. Les dates futures comptent pour aujourd'hui.
 */
export function dateGroup(date: Date | string, now = new Date()): DateGroup {
  const d = toDate(date);
  const day = parisDayIndex(d);
  const today = parisDayIndex(now);
  if (day >= today) return "today";
  // 1970-01-01 (index 0) était un jeudi : lundi = (index + 3) % 7 === 0.
  const monday = today - ((today + 3) % 7);
  return day >= monday ? "week" : "older";
}

/** Âge en années révolues à une date donnée. */
export function ageAt(birthIso: string, atIso: string): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthIso);
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(atIso);
  if (!b || !a) return null;
  let age = Number(a[1]) - Number(b[1]);
  if (Number(a[2]) < Number(b[2]) || (a[2] === b[2] && Number(a[3]) < Number(b[3]))) age -= 1;
  return age;
}

/** Accepte « 17/10/2026 », « 17-10-2026 », « 17.10.26 » ou « 2026-10-17 ». */
export function parseFrenchDate(input: string): string | null {
  const v = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(v);
  if (!m) return null;
  let year = Number(m[3]);
  if (m[3]!.length === 2) year += year > Number(String(new Date().getFullYear()).slice(2)) ? 1900 : 2000;
  const month = Number(m[2]);
  const day = Number(m[1]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
