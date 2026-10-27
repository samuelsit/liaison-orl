import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import { Font } from "@react-pdf/renderer";
import type { FontChoice } from "@/lib/schemas/organization";

export type Weight = 400 | 500 | 600 | 700;

const FILES: Record<FontChoice, Partial<Record<Weight, string>>> = {
  Comfortaa: {
    400: "Comfortaa-Regular.ttf",
    500: "Comfortaa-Medium.ttf",
    600: "Comfortaa-SemiBold.ttf",
    700: "Comfortaa-Bold.ttf",
  },
  Inter: { 400: "Inter-Regular.ttf", 500: "Inter-Medium.ttf", 600: "Inter-SemiBold.ttf", 700: "Inter-Bold.ttf" },
  Nunito: { 400: "Nunito-Regular.ttf", 700: "Nunito-Bold.ttf" },
  Montserrat: { 400: "Montserrat-Regular.ttf", 700: "Montserrat-Bold.ttf" },
  Lato: { 400: "Lato-Regular.ttf", 700: "Lato-Bold.ttf" },
};

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

function resolveWeight(family: FontChoice, weight: Weight): Weight {
  const available = FILES[family];
  if (available[weight]) return weight;
  return weight >= 600 ? 700 : 400;
}

let registered = false;

/**
 * Enregistre les polices embarquées dans react-pdf (une fois), puis force leur
 * rechargement avant chaque document : react-pdf conserve sinon, d'un document à
 * l'autre, un objet police dont l'état fait disparaître des glyphes (un « A » Medium
 * manquait après un document contenant « À » dans la même graisse).
 * `Font.reset()` ne convient pas : il vide les données sans permettre de les recharger.
 */
export function registerFonts() {
  if (!registered) {
    for (const [family, weights] of Object.entries(FILES) as [FontChoice, Partial<Record<Weight, string>>][]) {
      Font.register({
        family,
        fonts: (Object.entries(weights) as [string, string][]).map(([w, file]) => ({
          src: path.join(FONT_DIR, file),
          fontWeight: Number(w),
        })),
      });
    }
    Font.registerHyphenationCallback((word) => [word]);
    registered = true;
  }
  const families = Font.getRegisteredFonts();
  for (const family of Object.keys(FILES)) {
    for (const source of families[family]?.sources ?? []) {
      source.data = null;
      source.loadResultPromise = null;
    }
  }
}

type FkFont = ReturnType<typeof fontkit.create> & {
  unitsPerEm: number;
  ascent: number;
  layout: (s: string, features?: Record<string, boolean>) => { advanceWidth: number };
};
const cache = new Map<string, FkFont>();

function load(family: FontChoice, weight: Weight): FkFont {
  const w = resolveWeight(family, weight);
  const key = `${family}-${w}`;
  let f = cache.get(key);
  if (!f) {
    f = fontkit.create(readFileSync(path.join(FONT_DIR, FILES[family][w]!))) as FkFont;
    cache.set(key, f);
  }
  return f;
}

/** Largeur d'un texte en points. */
export function measure(text: string, family: FontChoice, weight: Weight, size: number): number {
  if (!text) return 0;
  const f = load(family, weight);
  return (f.layout(text, { kern: false, liga: false, clig: false }).advanceWidth / f.unitsPerEm) * size;
}

/** Hauteur de jambage supérieur (pour placer une ligne de base). */
export function ascent(family: FontChoice, weight: Weight, size: number): number {
  const f = load(family, weight);
  return (f.ascent / f.unitsPerEm) * size;
}
