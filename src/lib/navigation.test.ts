import { describe, expect, it } from "vitest";
import { loginHref, requestedPath, safeNext, withNext } from "./navigation";

describe("safeNext", () => {
  it("accepte les chemins relatifs de l'application", () => {
    expect(safeNext("/documents")).toBe("/documents");
    expect(safeNext("/documents/abc-123/envoi")).toBe("/documents/abc-123/envoi");
    expect(safeNext("/documents?statut=VALIDE&page=2")).toBe("/documents?statut=VALIDE&page=2");
    expect(safeNext("/patients#historique")).toBe("/patients#historique");
    expect(safeNext("/")).toBe("/");
  });

  it("refuse les URL absolues et les hôtes déguisés", () => {
    for (const bad of [
      "https://exemple.com",
      "http://exemple.com/documents",
      "//exemple.com",
      "///exemple.com",
      "/\\exemple.com",
      "\\\\exemple.com",
      "/\t/exemple.com",
      "/\n/exemple.com",
      "javascript:alert(1)",
      "documents",
      " /documents",
      "/redirect?to=https://exemple.com",
      "",
    ]) {
      expect(safeNext(bad), JSON.stringify(bad)).toBe("/");
    }
  });

  it("refuse les valeurs non textuelles ou trop longues", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(["/documents"])).toBe("/");
    expect(safeNext(`/${"a".repeat(3000)}`)).toBe("/");
  });

  it("ne renvoie jamais vers les pages de connexion", () => {
    expect(safeNext("/connexion")).toBe("/");
    expect(safeNext("/connexion/verification?suite=/documents")).toBe("/");
    expect(safeNext("/reinitialisation?token=x")).toBe("/");
    expect(safeNext("/bienvenue")).toBe("/");
    expect(safeNext("/connexions-medecins")).toBe("/connexions-medecins");
  });

  it("utilise la valeur de repli fournie", () => {
    expect(safeNext("https://exemple.com", "/compte")).toBe("/compte");
  });

  it("normalise les segments relatifs sans quitter l'origine", () => {
    expect(safeNext("/documents/../patients")).toBe("/patients");
    expect(safeNext("/../../etc")).toBe("/etc");
  });
});

describe("requestedPath", () => {
  it("retire le paramètre technique des navigations client", () => {
    expect(requestedPath("/documents", "?_rsc=abc")).toBe("/documents");
    expect(requestedPath("/documents", "?statut=VALIDE&_rsc=abc")).toBe("/documents?statut=VALIDE");
    expect(requestedPath("/", "")).toBe("/");
  });
});

describe("loginHref / withNext", () => {
  it("n'ajoute le retour que pour une page autre que l'accueil", () => {
    expect(loginHref("/")).toBe("/connexion");
    expect(loginHref(null)).toBe("/connexion");
    expect(loginHref("//exemple.com")).toBe("/connexion");
    expect(loginHref("/documents/abc?x=1")).toBe("/connexion?suite=%2Fdocuments%2Fabc%3Fx%3D1");
  });

  it("complète une URL interne existante", () => {
    expect(withNext("/connexion/verification", "/patients")).toBe("/connexion/verification?suite=%2Fpatients");
    expect(withNext("/connexion?vue=oubli", "/patients")).toBe("/connexion?vue=oubli&suite=%2Fpatients");
    expect(withNext("/connexion/verification", "/")).toBe("/connexion/verification");
  });
});
