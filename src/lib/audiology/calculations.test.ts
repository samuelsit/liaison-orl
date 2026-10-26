import { describe, expect, it } from "vitest";
import { emptyAudiometry, type Curve } from "@/lib/schemas/audiometry";
import { biapClass, globalLoss, prostheticGain, ptaBiap, suggestDegree } from "./calculations";

const curve = (values: Record<string, number | null>): Curve =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, confidence: "high" as const }]));

describe("perte moyenne BIAP", () => {
  it("moyenne 500/1000/2000/4000 Hz", () => {
    expect(ptaBiap(curve({ "250": 10, "500": 30, "1000": 40, "2000": 50, "4000": 60, "8000": 90 })).value).toBe(45);
  });
  it("plafonne à 120 dB et compte les absences de réponse à 120", () => {
    const c = curve({ "500": 100, "1000": 110, "2000": 130, "4000": 0 });
    c["4000"] = { value: null, confidence: "high", noResponse: true };
    expect(ptaBiap(c).value).toBe(112.5);
  });
  it("n'invente pas de valeur manquante", () => {
    const r = ptaBiap(curve({ "500": 30, "1000": 40, "4000": 60 }));
    expect(r.value).toBeNull();
    expect(r.missing).toEqual(["2000"]);
  });
});

describe("classes BIAP", () => {
  it.each([
    [20, "normale", null],
    [20.4, "normale", null],
    [21, "legere", "legere"],
    [40, "legere", "legere"],
    [41, "moyenne1", "moyenne"],
    [56, "moyenne2", "moyenne"],
    [71, "severe1", "severe"],
    [90, "severe2", "severe"],
    [91, "profonde1", "profonde"],
    [119, "profonde3", "profonde"],
    [120, "totale", "profonde"],
  ])("%s dB → %s", (pta, key, degree) => {
    expect(biapClass(pta).key).toBe(key);
    expect(biapClass(pta).degree).toBe(degree);
  });
});

describe("perte globale bilatérale", () => {
  it("pondère 7/3 la meilleure et la moins bonne oreille", () => {
    expect(globalLoss(45, 38)).toBe(40.1);
    expect(globalLoss(null, 50)).toBe(50);
    expect(globalLoss(null, null)).toBeNull();
  });
});

describe("suggestion du degré et des oreilles", () => {
  it("propose « les deux » et le degré issu de la perte globale, avec la règle", () => {
    const a = emptyAudiometry();
    a.right.air = curve({ "500": 40, "1000": 45, "2000": 50, "4000": 65 });
    a.left.air = curve({ "500": 35, "1000": 40, "2000": 55, "4000": 70 });
    const s = suggestDegree(a);
    expect(s.right.value).toBe(50);
    expect(s.left.value).toBe(50);
    expect(s.degree).toBe("moyenne");
    expect(s.ears).toBe("deux");
    expect(s.rule).toContain("BIAP");
  });
  it("ne propose qu'une oreille si l'autre est normale", () => {
    const a = emptyAudiometry();
    a.right.air = curve({ "500": 10, "1000": 15, "2000": 15, "4000": 20 });
    a.left.air = curve({ "500": 50, "1000": 55, "2000": 60, "4000": 70 });
    expect(suggestDegree(a).ears).toBe("gauche");
  });
});

describe("gain prothétique", () => {
  it("calcule le gain par fréquence, le gain moyen et le gain en intelligibilité", () => {
    const a = emptyAudiometry();
    a.freeField.unaided = curve({ "250": 40, "500": 45, "1000": 50, "2000": 55, "4000": 65 });
    a.freeField.aided = curve({ "250": 30, "500": 25, "1000": 25, "2000": 30, "4000": 40 });
    a.freeField.speechUnaided = { srt: { value: 55, confidence: "high" }, maxScore: { value: 60, confidence: "high" }, maxScoreLevel: null };
    a.freeField.speechAided = { srt: { value: 35, confidence: "high" }, maxScore: { value: 90, confidence: "medium" }, maxScoreLevel: null };
    const g = prostheticGain(a);
    expect(g.perFrequency.find((p) => p.freq === "250")?.gain).toBe(10);
    expect(g.mean).toBe(23.8);
    expect(g.meanFrequencies).toEqual(["500", "1000", "2000", "4000"]);
    expect(g.speech.srtGain).toBe(20);
    expect(g.speech.scoreGain).toBe(30);
    expect(g.noise).toBeNull();
  });
  it("renvoie null sans mesures en champ libre", () => {
    expect(prostheticGain(emptyAudiometry()).mean).toBeNull();
  });
});
