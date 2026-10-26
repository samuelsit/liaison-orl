import { describe, expect, it } from "vitest";
import { can, canAccessCentre } from "./permissions";

const settings = (over: Partial<{ assistantsCanSend: boolean; audioprosCanEditDirectory: boolean }> = {}) => ({
  permissions: { assistantsCanSend: false, audioprosCanEditDirectory: true, ...over },
});
const admin = { role: "admin" as const, canSend: false, centreIds: [] };
const audio = { role: "audioprothesiste" as const, canSend: false, centreIds: ["c1"] };
const assistant = { role: "assistant" as const, canSend: false, centreIds: ["c1"] };

describe("can", () => {
  it("donne tous les droits à l'administrateur", () => {
    expect(can(admin, "admin.access")).toBe(true);
    expect(can(admin, "prescriber.merge")).toBe(true);
  });

  it("autorise l'audioprothésiste à valider et envoyer, pas à administrer", () => {
    expect(can(audio, "document.validate", settings())).toBe(true);
    expect(can(audio, "document.send", settings())).toBe(true);
    expect(can(audio, "admin.access", settings())).toBe(false);
    expect(can(audio, "prescriber.import", settings())).toBe(false);
  });

  it("respecte l'option d'édition de l'annuaire par les audioprothésistes", () => {
    expect(can(audio, "prescriber.edit", settings({ audioprosCanEditDirectory: false }))).toBe(false);
    expect(can(assistant, "prescriber.edit", settings({ audioprosCanEditDirectory: false }))).toBe(true);
  });

  it("limite l'assistant(e) aux brouillons sauf autorisation d'envoi", () => {
    expect(can(assistant, "document.create", settings())).toBe(true);
    expect(can(assistant, "document.validate", settings())).toBe(false);
    expect(can(assistant, "document.send", settings())).toBe(false);
    expect(can(assistant, "document.send", settings({ assistantsCanSend: true }))).toBe(true);
    expect(can({ ...assistant, canSend: true }, "document.send", settings())).toBe(true);
  });
});

describe("canAccessCentre", () => {
  it("restreint aux centres rattachés sauf pour l'administrateur", () => {
    expect(canAccessCentre(audio, "c1")).toBe(true);
    expect(canAccessCentre(audio, "c2")).toBe(false);
    expect(canAccessCentre(admin, "c2")).toBe(true);
  });
});
