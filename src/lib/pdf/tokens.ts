import { contrastRatio, mix } from "@/lib/brand";
import type { BrandColors } from "@/lib/schemas/organization";

/** 1 mm en points PDF. */
export const MM = 72 / 25.4;
export const mm = (v: number) => v * MM;

export const PAGE = { width: 210, height: 297 } as const;

/**
 * Grille des documents (mm). Tous les espacements sont des multiples de 2 ou 4 mm.
 * Les marges de contenu restent très au-delà de la zone bloquée Pingen (5 mm).
 */
export const GRID = {
  marginX: 20,
  /** Haut du contenu des pages 2 et suivantes (sous l'en-tête réduit). */
  contentTop: 32,
  /** Début du corps en page 1 : 8 mm sous la zone d'affranchissement. */
  bodyTop: 96,
  /** Colonne de droite (bloc destinataire, signature) : texte de la zone d'adresse (110 + 2 mm). */
  rightColumn: 112,
  /** Largeur de la colonne d'en-tête : rien à droite de x = 88 mm entre y = 30 et 94 mm. */
  headerWidth: 66,
  /** Bas du dernier texte du pied de page (10 mm au-dessus du bord). */
  footerBottom: 287,
  /** Air entre le contenu et le filet du pied de page. */
  footerGap: 6,
} as const;

export const CONTENT_WIDTH = PAGE.width - 2 * GRID.marginX;

/** Échelle typographique d'impression (pt). Rien en dessous de 7,5 pt. */
export const TYPE = {
  title: 15,
  section: 10.5,
  body: 10,
  bodyLeading: 1.45,
  label: 8.5,
  small: 8.5,
  footer: 7.5,
  address: 10,
} as const;

/** Trois graisses au maximum. */
export const WEIGHT = { regular: 400, medium: 500, semibold: 600 } as const;

const WHITE = "#FFFFFF";

function darkenUntil(color: string, background: string, ratio: number): string {
  let c = color;
  for (let i = 0; i < 30 && contrastRatio(c, background) < ratio; i++) c = mix(c, "#000000", 0.06);
  return c;
}

export interface DocumentTokens {
  /** Couleur de marque : titres, libellés forts, filets. */
  primary: string;
  /** Accent ponctuel (filet court, puces) : jamais pour du texte. */
  accent: string;
  /** Texte courant : gris très foncé. */
  ink: string;
  /** Libellés et mentions secondaires (≥ 4,5:1 sur blanc et sur la teinte). */
  label: string;
  /** Filets fins des tableaux. */
  hairline: string;
  /** Fond très clair des encadrés (bleu à 5 %). */
  tint: string;
  /** Grille de l'audiogramme. */
  grid: string;
}

/**
 * Jetons des documents dérivés de la marque : toutes les couleurs viennent de la
 * configuration, puis sont corrigées si nécessaire pour garantir le contraste WCAG AA.
 */
export function documentTokens(colors: Pick<BrandColors, "primary" | "accent" | "text">): DocumentTokens {
  const tint = mix(colors.primary, WHITE, 0.95);
  const primary = darkenUntil(colors.primary, tint, 4.5);
  const ink = darkenUntil(colors.text, tint, 12);
  const label = darkenUntil(mix(ink, WHITE, 0.4), tint, 4.5);
  return {
    primary,
    accent: colors.accent,
    ink,
    label,
    hairline: mix(ink, WHITE, 0.86),
    tint,
    grid: mix(ink, WHITE, 0.82),
  };
}
