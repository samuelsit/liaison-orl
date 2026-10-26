import { describe, expect, it } from "vitest";
import { capitalizeName, formatPersonName, initials, normalizeSearch, prefixWordsRegex } from "./text";
import { ageAt, formatIsoDate, parseFrenchDate } from "./dates";

describe("texte", () => {
  it("normalise sans accents", () => {
    expect(normalizeSearch("  Hélène  GARNIER-Évreux ")).toBe("helene garnier-evreux");
  });
  it("cherche par début de mots dans n'importe quel ordre", () => {
    const r = prefixWordsRegex("gar hel")!;
    expect(r.test("helene garnier pierrefitte")).toBe(true);
    expect(r.test("michel dupont")).toBe(false);
    expect(prefixWordsRegex("   ")).toBeNull();
  });
  it("met en forme les noms", () => {
    expect(capitalizeName("jean-michel d'ARC")).toBe("Jean-Michel D'Arc");
    expect(formatPersonName("claire", "morel")).toBe("Claire MOREL");
    expect(initials("Jeanne", "Durand")).toBe("J. D.");
  });
});

describe("dates", () => {
  it("formate et analyse les dates françaises", () => {
    expect(formatIsoDate("2026-10-17")).toBe("17/10/2026");
    expect(parseFrenchDate("17/10/2026")).toBe("2026-10-17");
    expect(parseFrenchDate("1.2.46")).toBe("1946-02-01");
    expect(parseFrenchDate("31/02/2020")).toBeNull();
  });
  it("calcule l'âge", () => {
    expect(ageAt("1946-03-12", "2026-03-11")).toBe(79);
    expect(ageAt("1946-03-12", "2026-03-12")).toBe(80);
  });
});
