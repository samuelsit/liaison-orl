import { describe, expect, it } from "vitest";
import { formatRecipientAddress } from "./address";

const base = {
  civility: "Dr",
  firstName: "Antoine",
  lastName: "Lefèvre",
  practiceName: "Cabinet ORL de la Basilique",
  address: { line1: "5, rue Gabriel-Péri", line2: "", postalCode: "93200", city: "Saint-Denis", country: "France" },
};

describe("bloc adresse La Poste / Pingen", () => {
  it("met en forme selon la norme (majuscules, sans ponctuation, pays en dernier)", () => {
    const res = formatRecipientAddress(base);
    expect(res.errors).toEqual([]);
    expect(res.lines).toEqual(["Dr Antoine LEFÈVRE", "Cabinet ORL de la Basilique", "5 RUE GABRIEL PERI", "93200 SAINT DENIS", "FRANCE"]);
    expect(res.lines.every((l) => l.length <= 38)).toBe(true);
  });

  it("signale les adresses incomplètes ou invalides", () => {
    const res = formatRecipientAddress({ ...base, address: { ...base.address, line1: "", postalCode: "932" } });
    expect(res.errors).toContain("L'adresse (numéro et voie) est manquante.");
    expect(res.errors).toContain("Le code postal doit comporter 5 chiffres.");
  });

  it("abrège les lignes trop longues avec un avertissement", () => {
    const res = formatRecipientAddress({ ...base, practiceName: "Centre hospitalier intercommunal de la vallée de la Seine — service ORL" });
    expect(res.lines[1]!.length).toBe(38);
    expect(res.warnings.length).toBe(1);
  });

  it("gère les adresses étrangères", () => {
    const res = formatRecipientAddress({ ...base, address: { line1: "Rue de la Loi 16", line2: "", postalCode: "1000", city: "Bruxelles", country: "Belgique" } });
    expect(res.errors).toEqual([]);
    expect(res.lines.at(-1)).toBe("BELGIQUE");
  });
});
