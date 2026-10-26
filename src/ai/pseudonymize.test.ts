import { describe, expect, it } from "vitest";
import { buildEntities, containsIdentity, pseudonymize, reidentify } from "./pseudonymize";

const entities = buildEntities({
  patient: { civility: "Mme", firstName: "Hélène", lastName: "Lefort", birthDate: "1946-03-12" },
  prescriber: { civility: "Dr", firstName: "Antoine", lastName: "Garnier" },
});

describe("pseudonymisation", () => {
  it("remplace nom, prénom, date de naissance et prescripteur (casse et accents ignorés)", () => {
    const text = "Mme Hélène LEFORT, née le 12/03/1946, vue pour le Dr Garnier. helene lefort se plaint de vertiges.";
    const p = pseudonymize(text, entities);
    expect(p).toBe("[PATIENT], née le [DATE_NAISSANCE], vue pour le [MEDECIN]. [PATIENT] se plaint de vertiges.");
    expect(containsIdentity(p, entities)).toBe(false);
    expect(containsIdentity(text, entities)).toBe(true);
  });

  it("ne remplace pas un nom inclus dans un autre mot", () => {
    expect(pseudonymize("Lefortier est un autre patient", entities)).toBe("Lefortier est un autre patient");
  });

  it("gère les variantes de date et réinjecte l'identité", () => {
    expect(pseudonymize("né le 12 mars 1946 ou 12.03.1946", entities)).toBe("né le [DATE_NAISSANCE] ou [DATE_NAISSANCE]");
    expect(reidentify("Nous avons revu [PATIENT] à la demande du [MEDECIN].", entities)).toBe("Nous avons revu Mme LEFORT à la demande du Dr GARNIER.");
  });
});
