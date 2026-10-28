import { describe, expect, it } from "vitest";
import { DOCUMENT_STATUSES, isSendableType, statusesFor } from "./document";

describe("documents envoyables", () => {
  it("seul le compte rendu s'envoie ; l'adressage s'imprime ou se télécharge", () => {
    expect(isSendableType("COMPTE_RENDU")).toBe(true);
    expect(isSendableType("ADRESSAGE")).toBe(false);
  });

  it("un adressage n'a que les statuts Brouillon et Validé", () => {
    expect(statusesFor("ADRESSAGE")).toEqual(["BROUILLON", "VALIDE"]);
    expect(statusesFor("COMPTE_RENDU")).toEqual(DOCUMENT_STATUSES);
    expect(statusesFor(null)).toEqual(DOCUMENT_STATUSES);
  });
});
