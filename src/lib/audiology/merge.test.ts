import { describe, expect, it } from "vitest";
import { emptyAudiometry, type Audiometry, type Confidence, type Curve } from "@/lib/schemas/audiometry";
import { countAllMeasures, prostheticGain, suggestDegree } from "./calculations";
import { bilanKind, mergeExtractions, remapCondition, resolveConflict, type MergeSource } from "./merge";
import { getMeasure, listLowConfidence } from "./refs";

const curve = (values: Record<string, number>, confidence: Confidence = "high"): Curve =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, confidence }]));

const src = (id: string, audiometry: Audiometry, minute: number, extra: Partial<MergeSource> = {}): MergeSource => ({
  id,
  fileName: `${id}.pdf`,
  createdAt: new Date(Date.UTC(2026, 10, 9, 10, minute)),
  audiometry,
  condition: "auto",
  aidedSheet: false,
  ...extra,
});

function tonal(): Audiometry {
  const a = emptyAudiometry();
  a.right.air = curve({ "500": 40, "1000": 45, "2000": 50, "4000": 65 });
  a.left.air = curve({ "500": 35, "1000": 40, "2000": 55, "4000": 70 });
  a.right.bone = curve({ "500": 35, "1000": 40 });
  a.notes = "Tableau imprimé lisible.";
  return a;
}

function vocal(): Audiometry {
  const a = emptyAudiometry();
  a.right.speech = { srt: { value: 50, confidence: "high" }, maxScore: { value: 90, confidence: "high" }, maxScoreLevel: { value: 70, confidence: "high" } };
  a.freeField.speechUnaided = { srt: { value: 55, confidence: "high" }, maxScore: { value: 80, confidence: "high" }, maxScoreLevel: null };
  a.freeField.speechAided = { srt: { value: 35, confidence: "medium" }, maxScore: { value: 95, confidence: "high" }, maxScoreLevel: null };
  return a;
}

function aidedSheet(): Audiometry {
  // Feuille « gain prothétique » : le modèle a dessiné O / X, mais tout est appareillé.
  const a = emptyAudiometry();
  a.right.air = curve({ "500": 25, "1000": 25, "2000": 30, "4000": 40 });
  a.left.air = curve({ "500": 25, "1000": 30, "2000": 30, "4000": 45 });
  a.freeField.unaided = curve({ "500": 20, "1000": 25, "2000": 25, "4000": 35 });
  return a;
}

describe("réinterprétation d'un fichier", () => {
  it("« avec appareils » déplace casque → appareillé par oreille, champ libre sans → avec, vocale → appareillée", () => {
    const a = remapCondition(aidedSheet(), "aided", false);
    expect(a.right.air).toEqual({});
    expect(getMeasure(a, { kind: "curve", path: "right.aided", freq: "1000" })?.value).toBe(25);
    expect(getMeasure(a, { kind: "curve", path: "freeField.aided", freq: "4000" })?.value).toBe(35);
    expect(a.freeField.unaided).toEqual({});
    const v = remapCondition(vocal(), "aided", false);
    expect(v.right.speech.srt).toBeNull();
    // La vocale appareillée déjà lue garde la priorité ; la vocale au casque comble ce qui manque.
    expect(v.freeField.speechAided.srt?.value).toBe(35);
    expect(v.freeField.speechAided.maxScoreLevel?.value).toBe(70);
    expect(v.freeField.speechUnaided.srt).toBeNull();
  });

  it("« sans appareil » fait l'inverse et l'automatique suit la détection du modèle", () => {
    const aided = remapCondition(aidedSheet(), "aided", false);
    const back = remapCondition(aided, "unaided", false);
    expect(back.right.aided).toEqual({});
    expect(getMeasure(back, { kind: "curve", path: "right.air", freq: "1000" })?.value).toBe(25);
    expect(remapCondition(tonal(), "auto", false)).toEqual(tonal());
    expect(remapCondition(aidedSheet(), "auto", true).right.air).toEqual({});
  });

  it("déplace aussi les mesures dans le bruit", () => {
    const a = emptyAudiometry();
    a.noise = { testName: "VRB", unaidedSnr: { value: 4, confidence: "high" }, aidedSnr: null, unaidedScore: { value: 60, confidence: "high" }, aidedScore: null };
    const r = remapCondition(a, "aided", false);
    expect(r.noise?.aidedSnr?.value).toBe(4);
    expect(r.noise?.aidedScore?.value).toBe(60);
    expect(r.noise?.unaidedSnr).toBeNull();
  });
});

describe("fusion de plusieurs bilans", () => {
  it("assemble tonale, vocale et feuille appareillée en une seule audiométrie exploitable", () => {
    const { audiometry: a, conflicts } = mergeExtractions([src("tonal", tonal(), 0), src("vocal", vocal(), 1), src("gain", aidedSheet(), 2, { aidedSheet: true })], null);
    expect(conflicts).toEqual([]);
    expect(getMeasure(a, { kind: "curve", path: "right.air", freq: "1000" })).toEqual({ value: 45, confidence: "high", source: "tonal" });
    expect(getMeasure(a, { kind: "curve", path: "right.aided", freq: "1000" })).toEqual({ value: 25, confidence: "high", source: "gain" });
    expect(getMeasure(a, { kind: "speech", target: "speechAided", key: "srt" })).toEqual({ value: 35, confidence: "medium", source: "vocal" });
    expect(a.notes).toBe("tonal.pdf : Tableau imprimé lisible.");
    expect(countAllMeasures(a)).toBe(10 + 7 + 4 + 8);
    // Le compte rendu peut en tirer le degré et le gain.
    expect(suggestDegree(a).degree).toBe("moyenne");
    // La feuille appareillée n'apporte aucun champ libre sans appareil : la référence est la CA au casque, et c'est dit.
    const g = prostheticGain(a);
    expect(g.perEar.right?.reference).toBe("air");
    expect(g.perEar.right?.mean).toBe(20);
    expect(g.meanSource).toBe("per_ear");
    expect(g.rule).toContain("casque");
    expect(g.speech.srtGain).toBe(20);
  });

  it("la confiance la plus haute l'emporte ; à égalité, le fichier le plus ancien", () => {
    const first = emptyAudiometry();
    first.right.air = curve({ "1000": 45 }, "medium");
    const second = emptyAudiometry();
    second.right.air = curve({ "1000": 47 }, "high");
    const third = emptyAudiometry();
    third.right.air = curve({ "1000": 49 }, "high");
    const { audiometry, conflicts } = mergeExtractions([src("c", third, 2), src("a", first, 0), src("b", second, 1)], null);
    // 45 → 47 : écart ≤ 5 dB, pas de conflit, la confiance haute gagne ; 47 → 49 : égalité, le plus ancien reste.
    expect(getMeasure(audiometry, { kind: "curve", path: "right.air", freq: "1000" })).toEqual({ value: 47, confidence: "high", source: "b" });
    expect(conflicts).toEqual([]);
  });

  it("signale un conflit au-delà de 5 dB, abaisse la confiance et garde les deux lectures", () => {
    const a = emptyAudiometry();
    a.right.air = curve({ "1000": 45, "2000": 50 });
    const b = emptyAudiometry();
    b.right.air = curve({ "1000": 60, "2000": 55 });
    const res = mergeExtractions([src("a", a, 0), src("b", b, 1)], null);
    const ref = { kind: "curve", path: "right.air", freq: "1000" } as const;
    expect(getMeasure(res.audiometry, ref)).toEqual({ value: 45, confidence: "low", source: "a" });
    expect(getMeasure(res.audiometry, { kind: "curve", path: "right.air", freq: "2000" })?.confidence).toBe("high");
    expect(res.conflicts).toEqual([
      { ref, kept: { attachmentId: "a", fileName: "a.pdf", value: 45, confidence: "high" }, others: [{ attachmentId: "b", fileName: "b.pdf", value: 60, confidence: "high" }] },
    ]);
    expect(listLowConfidence(res.audiometry)).toEqual([ref]);
  });

  it("une lecture plus sûre mais différente prend la place et l'ancienne devient candidate", () => {
    const a = emptyAudiometry();
    a.left.air = curve({ "500": 30 }, "low");
    const b = emptyAudiometry();
    b.left.air = curve({ "500": 50 }, "high");
    const res = mergeExtractions([src("a", a, 0), src("b", b, 1)], null);
    expect(getMeasure(res.audiometry, { kind: "curve", path: "left.air", freq: "500" })).toEqual({ value: 50, confidence: "low", source: "b" });
    expect(res.conflicts[0]?.kept.attachmentId).toBe("b");
    expect(res.conflicts[0]?.others.map((c) => c.attachmentId)).toEqual(["a"]);
  });

  it("en pourcentage, la moindre différence est un conflit ; une absence de réponse contre une valeur aussi", () => {
    const a = emptyAudiometry();
    a.freeField.speechAided = { srt: null, maxScore: { value: 90, confidence: "high" }, maxScoreLevel: null };
    a.right.air = { "8000": { value: null, confidence: "high", noResponse: true } };
    const b = emptyAudiometry();
    b.freeField.speechAided = { srt: null, maxScore: { value: 92, confidence: "high" }, maxScoreLevel: null };
    b.right.air = curve({ "8000": 110 });
    const res = mergeExtractions([src("a", a, 0), src("b", b, 1)], null);
    expect(res.conflicts.map((c) => c.ref)).toEqual([
      { kind: "curve", path: "right.air", freq: "8000" },
      { kind: "speech", target: "speechAided", key: "maxScore" },
    ]);
    expect(res.conflicts[0]?.kept).toMatchObject({ value: null, noResponse: true });
  });

  it("conserve les valeurs saisies à la main (sans provenance) et lève leur conflit", () => {
    const a = emptyAudiometry();
    a.right.air = curve({ "1000": 45 });
    const b = emptyAudiometry();
    b.right.air = curve({ "1000": 60 });
    const previous = mergeExtractions([src("a", a, 0), src("b", b, 1)], null).audiometry;
    // L'audioprothésiste tape 50 dans la case (confiance élevée, aucune source).
    const edited: Audiometry = { ...previous, right: { ...previous.right, air: { "1000": { value: 50, confidence: "high" } } } };
    const res = mergeExtractions([src("a", a, 0), src("b", b, 1)], edited);
    expect(getMeasure(res.audiometry, { kind: "curve", path: "right.air", freq: "1000" })).toEqual({ value: 50, confidence: "high" });
    expect(res.conflicts).toEqual([]);
  });

  it("retirer un fichier retire ses mesures ; relire un fichier remplace les siennes", () => {
    const all = mergeExtractions([src("tonal", tonal(), 0), src("vocal", vocal(), 1)], null).audiometry;
    const without = mergeExtractions([src("tonal", tonal(), 0)], all).audiometry;
    expect(getMeasure(without, { kind: "speech", target: "right", key: "srt" })).toBeNull();
    expect(getMeasure(without, { kind: "curve", path: "right.air", freq: "500" })?.value).toBe(40);
    const reread = tonal();
    reread.right.air = curve({ "500": 42, "1000": 45, "2000": 50, "4000": 65 });
    const next = mergeExtractions([src("tonal", reread, 0), src("vocal", vocal(), 1)], all).audiometry;
    expect(getMeasure(next, { kind: "curve", path: "right.air", freq: "500" })?.value).toBe(42);
  });

  it("un bilan vocal seul suffit", () => {
    const res = mergeExtractions([src("vocal", vocal(), 0)], null);
    expect(countAllMeasures(res.audiometry)).toBe(7);
    expect(suggestDegree(res.audiometry).degree).toBeNull();
    expect(prostheticGain(res.audiometry).speech.scoreGain).toBe(15);
  });

  it("garde le nom du test dans le bruit et concatène les remarques", () => {
    const a = emptyAudiometry();
    a.noise = { testName: "HINT", unaidedSnr: { value: 5, confidence: "high" }, aidedSnr: null, unaidedScore: null, aidedScore: null };
    a.notes = "Photo floue.";
    const b = emptyAudiometry();
    b.noise = { testName: null, unaidedSnr: null, aidedSnr: { value: 1, confidence: "high" }, unaidedScore: null, aidedScore: null };
    b.notes = "Reflet.";
    const res = mergeExtractions([src("a", a, 0), src("b", b, 1)], null);
    expect(res.audiometry.noise?.testName).toBe("HINT");
    expect(res.audiometry.noise?.aidedSnr?.value).toBe(1);
    expect(res.audiometry.notes).toBe("a.pdf : Photo floue. · b.pdf : Reflet.");
  });

  it("choisir un candidat écrit une valeur manuelle et lève le conflit", () => {
    const a = emptyAudiometry();
    a.right.air = curve({ "1000": 45 });
    const b = emptyAudiometry();
    b.right.air = curve({ "1000": 60 });
    const res = mergeExtractions([src("a", a, 0), src("b", b, 1)], null);
    const ref = { kind: "curve", path: "right.air", freq: "1000" } as const;
    const chosen = resolveConflict(res, ref, "b");
    expect(getMeasure(chosen.audiometry, ref)).toEqual({ value: 60, confidence: "high" });
    expect(chosen.conflicts).toEqual([]);
    // Un nouveau recalcul ne rouvre pas le conflit : la valeur manuelle est superposée.
    expect(mergeExtractions([src("a", a, 0), src("b", b, 1)], chosen.audiometry).conflicts).toEqual([]);
    expect(resolveConflict(res, ref, "inconnu")).toBe(res);
  });
});

describe("nature d'un fichier", () => {
  it("reconnaît tonale, appareillée, vocale, bruit, mixte et vide", () => {
    expect(bilanKind(tonal(), "auto", false)).toBe("tonale");
    expect(bilanKind(aidedSheet(), "auto", true)).toBe("appareillee");
    expect(bilanKind(aidedSheet(), "aided", false)).toBe("appareillee");
    expect(bilanKind(vocal(), "auto", false)).toBe("vocale");
    const n = emptyAudiometry();
    n.noise = { testName: "VRB", unaidedSnr: { value: 4, confidence: "high" }, aidedSnr: null, unaidedScore: null, aidedScore: null };
    expect(bilanKind(n, "auto", false)).toBe("bruit");
    const m = tonal();
    m.right.speech = vocal().right.speech;
    expect(bilanKind(m, "auto", false)).toBe("mixte");
    expect(bilanKind(emptyAudiometry(), "auto", false)).toBe("vide");
    expect(bilanKind(null, "auto", false)).toBe("vide");
  });
});
