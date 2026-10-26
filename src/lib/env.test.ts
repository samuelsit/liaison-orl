import { afterEach, describe, expect, it, vi } from "vitest";
import { mongoDbName, resetEnvCache } from "./env";

function withEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  resetEnvCache();
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("mongoDbName", () => {
  it("utilise MONGODB_DB quand il est valide", () => {
    withEnv({ MONGODB_DB: "liaison-orl-prod", MONGODB_URI: "mongodb+srv://u:p@cluster0.abcde.mongodb.net/autre" });
    expect(mongoDbName()).toBe("liaison-orl-prod");
  });

  it("déduit le nom du chemin de l'URI, sinon le nom par défaut", () => {
    withEnv({ MONGODB_DB: "", MONGODB_URI: "mongodb+srv://u:p@cluster0.abcde.mongodb.net/ma-base?retryWrites=true" });
    expect(mongoDbName()).toBe("ma-base");
    withEnv({ MONGODB_URI: "mongodb+srv://u:p@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" });
    expect(mongoDbName()).toBe("liaison-orl");
  });

  it("récupère une URI collée par erreur dans MONGODB_DB", () => {
    withEnv({ MONGODB_DB: "mongodb+srv://u:p@cluster0.abcde.mongodb.net/?appName=Cluster0" });
    expect(mongoDbName()).toBe("liaison-orl");
    withEnv({ MONGODB_DB: "mongodb+srv://u:p@cluster0.abcde.mongodb.net/prod" });
    expect(mongoDbName()).toBe("prod");
  });

  it("refuse un nom contenant un point avec un message explicite", () => {
    withEnv({ MONGODB_DB: "cluster0.abcde.mongodb.net" });
    expect(() => mongoDbName()).toThrow(/MONGODB_DB invalide/);
  });
});
