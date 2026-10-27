import { describe, expect, it } from "vitest";
import { formatRecipientAddress } from "./address";

const base = {
  civility: "Dr",
  firstName: "Antoine",
  lastName: "Lefèvre",
  practiceName: "Cabinet ORL de la Basilique",
  address: { line1: "5, rue Gabriel-Péri", line2: "", postalCode: "93200", city: "Saint-Denis", country: "France" },
};

/** Largeur approximative d'Inter 10 pt (mm) : suffit pour tester la logique de largeur. */
const approxMm = (line: string) => [...line].reduce((w, c) => w + (/[A-Z0-9]/.test(c) ? 2.4 : 1.9), 0);

describe("bloc adresse NF Z10-011 / Pingen", () => {
  it("met en forme selon la norme (majuscules, sans ponctuation, pays en dernier)", () => {
    const res = formatRecipientAddress(base);
    expect(res.errors).toEqual([]);
    expect(res.lines).toEqual([
      "Dr Antoine LEFÈVRE",
      "Cabinet ORL de la Basilique",
      "5 RUE GABRIEL PERI",
      "93200 SAINT DENIS",
      "FRANCE",
    ]);
    expect(res.lines.every((l) => l.length <= 38)).toBe(true);
  });

  it("signale les adresses incomplètes ou invalides", () => {
    const res = formatRecipientAddress({ ...base, address: { ...base.address, line1: "", postalCode: "932" } });
    expect(res.errors).toContain("L'adresse (numéro et voie) est manquante.");
    expect(res.errors).toContain("Le code postal doit comporter 5 chiffres.");
  });

  it("abrège une voie trop longue selon la norme au lieu de la tronquer", () => {
    const res = formatRecipientAddress({
      ...base,
      address: { ...base.address, line1: "128 boulevard du Maréchal de Lattre de Tassigny" },
    });
    expect(res.errors).toEqual([]);
    expect(res.lines).toContain("128 BD DU MAL DE LATTRE DE TASSIGNY");
    expect(res.warnings.join(" ")).toMatch(/abrégée/);
  });

  it("tient compte de la largeur imprimée, pas seulement du nombre de caractères", () => {
    const res = formatRecipientAddress(
      { ...base, address: { ...base.address, line1: "2 rue du Docteur Delafontaine" } },
      { measureMm: approxMm, maxWidthMm: 60 },
    );
    expect(res.lines).toContain("2 RUE DU DR DELAFONTAINE");
  });

  it("retire un nom de cabinet trop long (complément facultatif) avec un avertissement", () => {
    const res = formatRecipientAddress({
      ...base,
      practiceName: "Centre hospitalier intercommunal de la vallée de la Seine — service ORL",
    });
    expect(res.errors).toEqual([]);
    expect(res.lines).not.toContain(expect.stringContaining("hospitalier"));
    expect(res.warnings.length).toBe(1);
  });

  it("abrège le nom du destinataire (initiale, puis sans prénom)", () => {
    const res = formatRecipientAddress({
      ...base,
      firstName: "Marie-Clémentine",
      lastName: "de La Rochefoucauld-d'Estréville",
    });
    expect(res.lines[0]).toBe("Dr M. DE LA ROCHEFOUCAULD-D'ESTRÉVILLE");
    const tight = formatRecipientAddress(
      { ...base, firstName: "Marie-Clémentine", lastName: "de La Rochefoucauld-d'Estréville" },
      { measureMm: approxMm, maxWidthMm: 70 },
    );
    expect(tight.lines[0]).toBe("Dr DE LA ROCHEFOUCAULD-D'ESTRÉVILLE");
  });

  it("bloque l'envoi quand une ligne ne tient pas, même abrégée (jamais de troncature)", () => {
    const res = formatRecipientAddress({
      ...base,
      address: { ...base.address, line1: "12 chemin des Grandes Bruyères de la Forêt Domaniale de Montmorency" },
    });
    expect(res.errors.join(" ")).toMatch(/trop longue/);
  });

  it("ne dépasse jamais 6 lignes : le cabinet est retiré en premier", () => {
    const res = formatRecipientAddress({ ...base, address: { ...base.address, line2: "Bâtiment B, 2e étage" } });
    expect(res.lines.length).toBe(6);
    const more = formatRecipientAddress({
      ...base,
      address: { ...base.address, line2: "Bâtiment B" },
      practiceName: "Cabinet",
    });
    expect(more.lines.length).toBeLessThanOrEqual(6);
  });

  it("gère les adresses étrangères", () => {
    const res = formatRecipientAddress({
      ...base,
      address: { line1: "Rue de la Loi 16", line2: "", postalCode: "1000", city: "Bruxelles", country: "Belgique" },
    });
    expect(res.errors).toEqual([]);
    expect(res.lines.at(-1)).toBe("BELGIQUE");
  });
});
