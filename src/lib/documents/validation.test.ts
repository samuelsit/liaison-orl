import { describe, expect, it } from "vitest";
import { checkDocument } from "./validation";
import { emptyAdressage, emptyCompteRendu } from "./defaults";

const patient = { birthDate: "1946-03-12" };
const prescriber = { email: "a@b.test", address: { line1: "1 rue", postalCode: "75001", city: "Paris" } };

describe("validation des documents", () => {
  it("adressage : patient, prescripteur et au moins un examen", () => {
    const empty = checkDocument({ type: "ADRESSAGE", data: emptyAdressage("2026-10-17"), patient: null, prescriber: null });
    expect(Object.keys(empty.errors)).toEqual(["patientId", "prescriberId", "exams"]);
    const autre = checkDocument({ type: "ADRESSAGE", data: { ...emptyAdressage("2026-10-17"), exams: { conduits: false, bilan: false, autre: true } }, patient, prescriber });
    expect(autre.errors).toEqual({ autreText: "Précisez le motif « Autre »." });
    const ok = checkDocument({ type: "ADRESSAGE", data: { ...emptyAdressage("2026-10-17"), exams: { conduits: true, bilan: false, autre: false } }, patient, prescriber });
    expect(ok.errors).toEqual({});
  });

  it("compte rendu : champs essentiels bloquants, autres recommandés", () => {
    const r = checkDocument({ type: "COMPTE_RENDU", data: emptyCompteRendu("2026-10-17"), patient: { birthDate: "" }, prescriber });
    expect(Object.keys(r.errors).sort()).toEqual(["degree", "deviceBrand", "deviceClass", "deviceType", "ears", "patientBirthDate"]);
    expect(r.warnings).toContain("Commentaires");
    const full = checkDocument({
      type: "COMPTE_RENDU",
      data: { ...emptyCompteRendu("2026-10-17"), degree: "moyenne", ears: "deux", deviceType: "contour", deviceBrand: "autre", deviceBrandOther: "Phonak", deviceClass: "1" },
      patient,
      prescriber,
    });
    expect(full.errors).toEqual({});
  });
});
