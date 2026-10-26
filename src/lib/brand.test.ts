import { describe, expect, it } from "vitest";
import {
  accentForText,
  brandCssVariables,
  brandTint,
  centreDisplayName,
  contrastRatio,
  DEFAULT_COLORS,
  derivePalette,
  mix,
  onColor,
  primaryFillForDark,
  primaryForDark,
  primaryForLight,
  UI_SURFACES,
} from "./brand";

/** Marques représentatives : défaut, vert, violet, orange (claire), jaune (très claire), quasi noire. */
const BRANDS = ["#1F3F7A", "#1E7A4F", "#6D28D9", "#E8632B", "#F2C200", "#0F172A"];

describe("brand", () => {
  it("calcule un rapport de contraste WCAG", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#1F3F7A", "#FFFFFF")).toBeGreaterThan(4.5);
  });

  it("mélange les couleurs", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("dérive une palette lisible", () => {
    const p = derivePalette("#1F3F7A", "#E8632B");
    expect(p.primary).toBe("#1F3F7A");
    expect(contrastRatio(p.text, "#FFFFFF")).toBeGreaterThan(7);
    expect(contrastRatio(p.surface, "#FFFFFF")).toBeLessThan(1.15);
  });

  it("garantit un contraste AA pour l'accent", () => {
    expect(contrastRatio(accentForText("#E8632B"), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("compose le nom affiché d'un centre", () => {
    expect(centreDisplayName("Marque", "Ville")).toBe("Marque — Ville");
  });
});

describe("variables de marque de l'interface", () => {
  it("produit les valeurs attendues pour le thème par défaut", () => {
    const vars = brandCssVariables(DEFAULT_COLORS.primary, DEFAULT_COLORS.accent);
    expect(vars).toEqual({
      "--brand-primary": "#1F3F7A",
      "--brand-primary-text": "#1F3F7A",
      "--brand-primary-dark": "#7A8EB1",
      "--brand-primary-fill-dark": "#496393",
      "--brand-on-primary": "#FFFFFF",
      "--brand-on-primary-dark": "#FFFFFF",
      "--brand-accent": "#E8632B",
      "--brand-tint": "#E9ECF2",
    });
  });

  it.each(BRANDS)("texte de marque lisible en mode clair (%s)", (primary) => {
    const text = primaryForLight(primary);
    expect(contrastRatio(text, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text, UI_SURFACES.lightMuted)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text, brandTint(primary))).toBeGreaterThanOrEqual(4.5);
  });

  it("ne modifie pas une couleur de marque déjà lisible en mode clair", () => {
    expect(primaryForLight("#1F3F7A")).toBe("#1F3F7A");
    expect(primaryForLight("#6D28D9")).toBe("#6D28D9");
  });

  it.each(BRANDS)("texte de marque lisible sur toutes les surfaces sombres (%s)", (primary) => {
    const text = primaryForDark(primary);
    for (const surface of [UI_SURFACES.darkBackground, "#151B24", UI_SURFACES.darkPopover]) {
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(BRANDS)("aplat sombre et texte posé dessus lisibles (%s)", (primary) => {
    const fill = primaryFillForDark(primary);
    expect(contrastRatio(onColor(fill), fill)).toBeGreaterThanOrEqual(4.5);
    // L'aplat se détache du fond dès que le texte blanc le permet.
    if (onColor(fill) === "#FFFFFF" && contrastRatio(fill, UI_SURFACES.darkBackground) < 3) {
      expect(contrastRatio("#FFFFFF", mix(fill, "#FFFFFF", 0.05))).toBeLessThan(4.5);
    }
  });

  it("éclaircit l'aplat sombre d'une marque foncée sans dégrader le texte blanc", () => {
    const fill = primaryFillForDark("#1F3F7A");
    expect(contrastRatio(fill, UI_SURFACES.darkBackground)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#FFFFFF", fill)).toBeGreaterThanOrEqual(4.5);
    expect(primaryFillForDark("#1E7A4F")).toBe("#1E7A4F");
    expect(primaryFillForDark("#6D28D9")).toBe("#7B3DDD");
  });

  it("choisit un texte encre sur une marque claire et blanc sur une marque foncée", () => {
    expect(onColor("#1F3F7A")).toBe("#FFFFFF");
    expect(onColor("#E8632B")).toBe(UI_SURFACES.ink);
    expect(contrastRatio(onColor("#E8632B"), "#E8632B")).toBeGreaterThanOrEqual(4.5);
    expect(onColor("#F2C200")).toBe(UI_SURFACES.ink);
    expect(contrastRatio(onColor("#F2C200"), "#F2C200")).toBeGreaterThan(11);
    const orange = brandCssVariables("#E8632B", "#1F3F7A");
    expect(orange["--brand-on-primary"]).toBe(UI_SURFACES.ink);
    expect(orange["--brand-primary-fill-dark"]).toBe("#E8632B");
    expect(orange["--brand-on-primary-dark"]).toBe(UI_SURFACES.ink);
    expect(orange["--brand-primary-dark"]).toBe("#E8632B");
  });
});
