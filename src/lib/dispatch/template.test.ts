import { describe, expect, it } from "vitest";
import { renderSubject, renderTemplate } from "./template";
import { DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT } from "@/lib/brand";

describe("modèles d'e-mail", () => {
  it("remplace les variables et efface les inconnues", () => {
    expect(renderTemplate("Bonjour {{prescripteur.formule}} {{inconnue}}!", { "prescripteur.formule": "Cher Confrère" })).toBe("Bonjour Cher Confrère !");
  });
  it("évite le double point après des initiales", () => {
    expect(renderTemplate("concernant {{patient.initiales}}.", { "patient.initiales": "J. D." })).toBe("concernant J. D.");
    expect(renderTemplate("Suite...", {})).toBe("Suite...");
  });
  it("produit un objet minimisé par défaut (initiales)", () => {
    expect(renderSubject(DEFAULT_EMAIL_SUBJECT, { "document.type": "Compte rendu d'appareillage", "patient.initiales": "J. D." })).toBe("Compte rendu d'appareillage — J. D.");
  });
  it("rend le corps par défaut sans variables résiduelles", () => {
    const body = renderTemplate(DEFAULT_EMAIL_BODY, { "prescripteur.formule": "Cher Confrère", acces: "Lien", "audioprothesiste.nom": "Claire MOREL" });
    expect(body).not.toMatch(/\{\{/);
    expect(body.startsWith("Cher Confrère,")).toBe(true);
  });
});
