import { describe, expect, it } from "vitest";
import { compteRenduDataSchema, type CompteRenduData } from "@/lib/schemas/document";
import { commentFactsSignature, isCommentStale } from "./comment-facts";
import { crSectionStatuses } from "./section-status";
import { formatPrice, parsePrice } from "./price";

function data(patch: Partial<CompteRenduData> = {}): CompteRenduData {
  return { ...compteRenduDataSchema.parse({ schemaVersion: 1, reportDate: "2026-10-18" }), ...patch };
}

describe("commentaire à mettre à jour", () => {
  it("ignore le texte du commentaire et les espaces superflus", () => {
    const a = commentFactsSignature(data({ deviceModel: "Pure 7", comments: "A" }));
    expect(commentFactsSignature(data({ deviceModel: " Pure 7 ", comments: "B" }))).toBe(a);
    expect(commentFactsSignature(data({ deviceModel: "Pure 5" }))).not.toBe(a);
  });

  it("ne signale qu'un commentaire suggéré par l'IA et rédigé avec d'autres valeurs", () => {
    const before = data({ comments: "Texte", wearHoursPerDay: null });
    const sig = commentFactsSignature(before);
    const after = { ...before, wearHoursPerDay: 10 };
    expect(isCommentStale(after, ["comments"], sig)).toBe(true);
    expect(isCommentStale(before, ["comments"], sig)).toBe(false);
    // Modifié à la main : plus suggéré par l'IA, rien à signaler.
    expect(isCommentStale(after, [], sig)).toBe(false);
    expect(isCommentStale(after, ["comments"], null)).toBe(false);
    expect(isCommentStale({ ...after, comments: " " }, ["comments"], sig)).toBe(false);
  });
});

describe("état des sections", () => {
  const base = { patient: { birthDate: "1950-01-01" }, prescriber: {}, errors: {}, aiFields: [], bilan: { confirmed: false } };

  it("calcule l'avancement section par section", () => {
    const s = crSectionStatuses({ ...base, data: data({ degree: "moyenne", ears: "deux", deviceType: "contour", deviceBrand: "signia", deviceClass: "2" }) });
    expect(s).toEqual({ identity: "complete", bilan: "incomplete", patient: "complete", device: "complete", results: "incomplete", comments: "incomplete" });
  });

  it("exige la marque précisée pour « Autre » et la date de naissance du patient", () => {
    const s = crSectionStatuses({ ...base, patient: { birthDate: "" }, data: data({ deviceType: "contour", deviceBrand: "autre", deviceClass: "1" }) });
    expect(s.device).toBe("incomplete");
    expect(s.identity).toBe("incomplete");
  });

  it("garde une section incomplète tant qu'une suggestion de l'IA n'est pas relue", () => {
    const s = crSectionStatuses({ ...base, aiFields: ["degree"], bilan: { confirmed: true }, data: data({ degree: "legere", ears: "droite" }) });
    expect(s.patient).toBe("incomplete");
    expect(s.bilan).toBe("complete");
  });

  it("signale les erreurs de validation", () => {
    const s = crSectionStatuses({ ...base, errors: { deviceClass: "Indiquez la classe." }, data: data() });
    expect(s.device).toBe("error");
  });
});

describe("prix", () => {
  it("accepte les saisies brutes et formatées", () => {
    expect(parsePrice("1450")).toBe(1450);
    expect(parsePrice("1 450,50 €")).toBe(1450.5);
    expect(parsePrice("1 450")).toBe(1450);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBe("invalid");
    expect(parsePrice("200000")).toBe("invalid");
  });

  it("formate à la française", () => {
    expect(formatPrice(1450)).toBe("1 450");
    expect(formatPrice(1450.5)).toBe("1 450,50");
    expect(formatPrice(null)).toBe("");
  });
});
