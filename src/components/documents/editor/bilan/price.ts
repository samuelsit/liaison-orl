/** Prix saisi : chiffres, espaces (y compris insécables), virgule ou point, « € » toléré. */
export function parsePrice(raw: string): number | null | "invalid" {
  const s = raw.replace(/[\s  €]/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return "invalid";
  return Math.round(n * 100) / 100;
}

/** Affichage français (« 1 450 », « 1 450,50 ») hors saisie. */
export function formatPrice(v: number | null): string {
  if (v === null) return "";
  const cents = Math.round(v * 100) % 100 !== 0;
  return v.toLocaleString("fr-FR", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

/** Valeur brute pendant la saisie (« 1450,5 »). */
export function rawPrice(v: number | null): string {
  return v === null ? "" : String(v).replace(".", ",");
}
