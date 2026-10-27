import type { Style } from "@react-pdf/stylesheet";
import type { DocumentFontChoice } from "@/lib/schemas/organization";
import { TYPE, WEIGHT, documentTokens, type DocumentTokens } from "../tokens";
import type { PdfBrand } from "../model";

export interface DocTheme {
  font: DocumentFontChoice;
  t: DocumentTokens;
}

export function themeFor(brand: PdfBrand): DocTheme {
  return { font: brand.font, t: documentTokens(brand.colors) };
}

type Weight = (typeof WEIGHT)[keyof typeof WEIGHT];

/** Style de texte : police de la marque, taille, graisse, couleur, interligne. */
export function text(
  theme: DocTheme,
  size: number,
  weight: Weight = WEIGHT.regular,
  color = theme.t.ink,
  lineHeight = 1.3,
): Style {
  return { fontFamily: theme.font, fontSize: size, fontWeight: weight, color, lineHeight };
}

export const bodyStyle = (theme: DocTheme): Style =>
  text(theme, TYPE.body, WEIGHT.regular, theme.t.ink, TYPE.bodyLeading);
export const labelStyle = (theme: DocTheme): Style => text(theme, TYPE.label, WEIGHT.medium, theme.t.label);

/** Chiffres tabulaires (tableaux de mesures). */
export const TABULAR = ["tnum"] as const;
