import { describe, expect, it } from "vitest";
import { countLabel, dispFr, formatEuros, plural } from "./dispatch";

const NBSP = /[  ]/g;

describe("plural (règle française)", () => {
  it("0 et 1 au singulier, 2 et plus au pluriel", () => {
    expect(plural(0, "document", "documents")).toBe("document");
    expect(plural(1, "document", "documents")).toBe("document");
    expect(plural(2, "document", "documents")).toBe("documents");
    expect(plural(128, "envoi", "envois")).toBe("envois");
  });

  it("countLabel formate le nombre à la française", () => {
    expect(countLabel(1, "document", "documents")).toBe("1 document");
    expect(countLabel(1234, "envoi", "envois").replace(NBSP, " ")).toBe("1 234 envois");
  });
});

describe("libellés sans « (s) »", () => {
  it("envoi groupé", () => {
    expect(dispFr.bulk.summary(1)).toBe("1 document sera envoyé.");
    expect(dispFr.bulk.summary(3)).toBe("3 documents seront envoyés.");
    expect(dispFr.bulk.resultToast(2, 2)).toBe("2 documents envoyés.");
    expect(dispFr.bulk.resultToast(1, 3)).toBe("1 document envoyé sur 3.");
  });

  it("sélection des comptes rendus validés (seuls envoyables)", () => {
    expect(dispFr.documents.selectValidated(1)).toBe("Sélectionner le compte rendu validé");
    expect(dispFr.documents.selectValidated(4)).toBe("Sélectionner les 4 comptes rendus validés");
  });

  it("pages du courrier", () => {
    expect(dispFr.review.pagesLine(1)).toBe("1 page (page d'accompagnement incluse)");
    expect(dispFr.review.pagesLine(2)).toBe("2 pages (page d'accompagnement incluse)");
  });
});

describe("formatEuros", () => {
  it("centimes → euros", () => {
    expect(formatEuros(144).replace(NBSP, " ")).toBe("1,44 €");
  });
});
