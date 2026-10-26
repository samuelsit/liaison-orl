import { describe, expect, it } from "vitest";
import { emptyAudiometry } from "@/lib/schemas/audiometry";
import { emptyCompteRendu } from "@/lib/documents/defaults";
import { fromAudiometry, rawExtractionSchema, toAudiometry } from "./extraction-schema";
import { buildCommentFacts, factsToText } from "./facts";
import { mockComment, mockDictation, mockMotif, readDemoMarker, DEMO_MARKER } from "./mock";
import { estimateCostMicroUsd } from "./index";

describe("schéma d'extraction", () => {
  it("convertit la sortie du modèle et ignore les fréquences inconnues", () => {
    const a = emptyAudiometry();
    a.right.air = { "500": { value: 30, confidence: "high" }, "8000": { value: 120, confidence: "low", noResponse: true } };
    a.freeField.speechAided = { srt: { value: 35, confidence: "medium" }, maxScore: { value: 90, confidence: "high" }, maxScoreLevel: null };
    const raw = fromAudiometry(a);
    raw.thresholds.push({ curve: "left_air", frequency_hz: 1234, threshold_db: 40, no_response: false, confidence: "high" });
    expect(rawExtractionSchema.safeParse(raw).success).toBe(true);
    const back = toAudiometry(raw);
    expect(back.right.air).toEqual(a.right.air);
    expect(back.left.air).toEqual({});
    expect(back.freeField.speechAided.srt).toEqual({ value: 35, confidence: "medium" });
  });

  it("rejette un score d'intelligibilité hors limites (non détecté plutôt qu'inventé)", () => {
    const a = emptyAudiometry();
    const raw = fromAudiometry(a);
    raw.speech.push({ condition: "free_field_aided", measure: "max_score_percent", value: 140, confidence: "high" });
    expect(toAudiometry(raw).freeField.speechAided.maxScore).toEqual({ value: null, confidence: "low" });
  });

  it("signale un document qui n'est pas un bilan", () => {
    const raw = fromAudiometry(emptyAudiometry());
    expect(toAudiometry({ ...raw, is_audiogram: false }).notes).toMatch(/pas être un bilan/);
  });
});

describe("faits du commentaire", () => {
  it("ne transmet que les valeurs disponibles, sans identité", () => {
    const a = emptyAudiometry();
    a.right.air = { "500": { value: 40, confidence: "high" }, "1000": { value: 50, confidence: "high" }, "2000": { value: 60, confidence: "high" }, "4000": { value: 70, confidence: "high" } };
    a.freeField.unaided = { "1000": { value: 50, confidence: "high" } };
    a.freeField.aided = { "1000": { value: 30, confidence: "high" } };
    const data = { ...emptyCompteRendu("2026-10-17"), ears: "droite" as const, deviceBrand: "signia" as const, wearHoursPerDay: 10 };
    const facts = buildCommentFacts(data, a, { civility: "Mme", birthDate: "1946-03-12" }, "");
    expect(facts.age).toBe(80);
    expect(facts.meanGain).toBe(20);
    const text = factsToText(facts);
    expect(text).toContain("Perte moyenne OD : 55 dB");
    expect(text).toContain("Marque / modèle : Signia");
    expect(text).not.toContain("Perte moyenne OG");
    expect(text).not.toContain("1946");
  });
});

describe("mode démo", () => {
  it("relit le marqueur des bilans fictifs", () => {
    const raw = fromAudiometry(emptyAudiometry());
    const buf = Buffer.from(`%PDF-1.4 ... /Keywords (${DEMO_MARKER}${Buffer.from(JSON.stringify(raw)).toString("base64")}) ...`, "latin1");
    expect(readDemoMarker(buf)?.is_audiogram).toBe(true);
    expect(readDemoMarker(Buffer.from("aucun marqueur"))).toBeNull();
  });

  it("rédige des textes plausibles sans inventer de valeur", () => {
    const facts = buildCommentFacts({ ...emptyCompteRendu("2026-10-17"), ears: "deux", handling: "oui" }, null, { civility: "M.", birthDate: "" }, "");
    const c = mockComment(facts, "standard");
    expect(c).toContain("stéréophonique");
    expect(c).not.toMatch(/\d+ dB/);
    expect(mockMotif("bouchon cérumen OD, vertiges depuis 3 sem")).toBe(
      "Suspicion de bouchon cérumen à l'oreille droite. Vertiges évoluant depuis 3 semaines. Merci de votre avis.",
    );
    expect(mockDictation("euh le patient a des acoufènes virgule surtout le soir point")).toBe("Le patient a des acouphènes, surtout le soir.");
  });
});

describe("coût estimé", () => {
  it("applique les tarifs par million de jetons", () => {
    expect(estimateCostMicroUsd("claude-sonnet-5-5", { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(7000);
    expect(estimateCostMicroUsd("modele-inconnu", { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(0);
  });
});
