const NBSP = " ";

/**
 * Typographie française des textes saisis : apostrophe typographique, espace
 * insécable avant « : ; ! ? % € » et à l'intérieur des guillemets.
 */
export function typo(text: string): string {
  return text
    .replace(/'/g, "’")
    .replace(/[  ]*([:;!?%€»])(?=\s|$|[.,)])/g, `${NBSP}$1`)
    .replace(/«[  ]*/g, `«${NBSP}`)
    .replace(/(\d) (?=\d{3}\b)/g, `$1${NBSP}`);
}

/** Paragraphes d'un texte libre (lignes vides = nouveau paragraphe, retours simples conservés). */
export function paragraphs(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
