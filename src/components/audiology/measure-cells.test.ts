import { describe, expect, it } from "vitest";
import { emptyAudiometry, type Audiometry } from "@/lib/schemas/audiometry";
import {
  applyRowPaste,
  cellText,
  formatSigned,
  freqLong,
  gainBands,
  getCurve,
  getMeasure,
  hasIntermediateValues,
  listLowConfidence,
  markChecked,
  moveInGrid,
  parseCell,
  parsePastedValues,
  pathToSeriesKey,
  seriesKeyToPath,
  setMeasure,
  setNoiseName,
  toMeasure,
  visibleFrequencies,
} from "./measure-cells";

function sample(): Audiometry {
  const a = emptyAudiometry();
  a.right.air = { "500": { value: 30, confidence: "high" }, "1000": { value: 35, confidence: "low" } };
  a.left.bone = { "750": { value: 25, confidence: "medium" } };
  a.freeField.speechAided = { srt: { value: 30, confidence: "low" }, maxScore: null, maxScoreLevel: null };
  a.noise = { testName: "HINT", unaidedSnr: { value: 4, confidence: "low" }, aidedSnr: null, unaidedScore: null, aidedScore: null };
  return a;
}

describe("parseCell / cellText", () => {
  it("lit les nombres, la virgule et l'absence de réponse", () => {
    expect(parseCell("35")).toEqual({ value: 35, noResponse: false });
    expect(parseCell(" 7,5 ")).toEqual({ value: 7.5, noResponse: false });
    expect(parseCell("nr")).toEqual({ value: null, noResponse: true });
    expect(parseCell("N")).toEqual({ value: null, noResponse: true });
    expect(parseCell("")).toEqual({ value: null, noResponse: false });
  });

  it("refuse les valeurs hors plage", () => {
    expect(parseCell("abc")).toBe("invalid");
    expect(parseCell("150")).toBe("invalid");
    expect(parseCell("-30")).toBe("invalid");
    expect(parseCell("101", 100)).toBe("invalid");
  });

  it("convertit en mesure de confiance élevée et réaffiche", () => {
    expect(toMeasure({ value: null, noResponse: false })).toBeNull();
    expect(toMeasure({ value: null, noResponse: true })).toEqual({ value: null, confidence: "high", noResponse: true });
    expect(cellText({ value: 7.5, confidence: "high" })).toBe("7,5");
    expect(cellText({ value: null, confidence: "high", noResponse: true })).toBe("NR");
    expect(cellText(null)).toBe("");
  });
});

describe("confiance", () => {
  it("compte les valeurs faibles en tonale, vocale et bruit", () => {
    const low = listLowConfidence(sample());
    expect(low).toEqual([
      { kind: "curve", path: "right.air", freq: "1000" },
      { kind: "speech", target: "speechAided", key: "srt" },
      { kind: "noise", key: "unaidedSnr" },
    ]);
  });

  it("marque une valeur comme relue sans changer sa valeur", () => {
    const a = sample();
    const ref = { kind: "curve", path: "right.air", freq: "1000" } as const;
    const next = markChecked(a, ref);
    expect(getMeasure(next, ref)).toEqual({ value: 35, confidence: "high" });
    expect(listLowConfidence(next)).toHaveLength(2);
    // Les autres mesures sont conservées.
    expect(getMeasure(next, { kind: "curve", path: "right.air", freq: "500" })?.value).toBe(30);
  });

  it("modifie et supprime une mesure", () => {
    const ref = { kind: "speech", target: "right", key: "maxScore" } as const;
    const a = setMeasure(sample(), ref, { value: 80, confidence: "high" });
    expect(getMeasure(a, ref)?.value).toBe(80);
    expect(getMeasure(setMeasure(a, ref, null), ref)).toBeNull();
    const c = setMeasure(a, { kind: "curve", path: "right.air", freq: "500" }, null);
    expect(getCurve(c, "right.air")["500"]).toBeUndefined();
  });

  it("garde le nom du test dans le bruit", () => {
    expect(setNoiseName(emptyAudiometry(), "VRB").noise?.testName).toBe("VRB");
    expect(setNoiseName(sample(), "").noise?.testName).toBeNull();
  });
});

describe("fréquences intermédiaires", () => {
  it("détecte une valeur à 750 ou 1 500 Hz", () => {
    expect(hasIntermediateValues(sample())).toBe(true);
    expect(hasIntermediateValues(emptyAudiometry())).toBe(false);
    expect(visibleFrequencies(false)).not.toContain("750");
    expect(visibleFrequencies(true)).toContain("1500");
  });
});

describe("collage d'une ligne", () => {
  it("découpe sur espaces, tabulations et points-virgules", () => {
    expect(parsePastedValues("20\t25;30 NR")).toEqual([
      { value: 20, noResponse: false },
      { value: 25, noResponse: false },
      { value: 30, noResponse: false },
      { value: null, noResponse: true },
    ]);
    expect(parsePastedValues("20")).toBeNull();
    expect(parsePastedValues("20 abc")).toBeNull();
  });

  it("remplit vers la droite et ignore le surplus", () => {
    const freqs = visibleFrequencies(false);
    const values = parsePastedValues("40 45 50")!;
    const { next, count } = applyRowPaste(emptyAudiometry(), "left.air", freqs, "4000", values);
    expect(count).toBe(3);
    expect(getCurve(next, "left.air")).toEqual({
      "4000": { value: 40, confidence: "high" },
      "6000": { value: 45, confidence: "high" },
      "8000": { value: 50, confidence: "high" },
    });
    const overflow = applyRowPaste(emptyAudiometry(), "left.air", freqs, "8000", values);
    expect(overflow.count).toBe(1);
  });
});

describe("navigation au clavier", () => {
  it("se déplace sans boucler aux bords", () => {
    expect(moveInGrid({ row: 0, col: 0 }, "down", 6, 9)).toEqual({ row: 1, col: 0 });
    expect(moveInGrid({ row: 5, col: 0 }, "down", 6, 9)).toBeNull();
    expect(moveInGrid({ row: 0, col: 0 }, "up", 6, 9)).toBeNull();
    expect(moveInGrid({ row: 2, col: 8 }, "right", 6, 9)).toBeNull();
    expect(moveInGrid({ row: 2, col: 4 }, "rowStart", 6, 9)).toEqual({ row: 2, col: 0 });
    expect(moveInGrid({ row: 2, col: 4 }, "rowEnd", 6, 9)).toEqual({ row: 2, col: 8 });
  });

  it("Entrée descend puis passe à la colonne suivante", () => {
    expect(moveInGrid({ row: 1, col: 3 }, "enter", 6, 9)).toEqual({ row: 2, col: 3 });
    expect(moveInGrid({ row: 5, col: 3 }, "enter", 6, 9)).toEqual({ row: 0, col: 4 });
    expect(moveInGrid({ row: 5, col: 8 }, "enter", 6, 9)).toBeNull();
  });
});

describe("audiogramme", () => {
  it("relie les séries aux lignes du tableau", () => {
    expect(seriesKeyToPath("left-bone")).toBe("left.bone");
    expect(seriesKeyToPath("inconnu")).toBeNull();
    expect(pathToSeriesKey("freeField.aided")).toBe("ff-aided");
  });

  it("ne garde que les fréquences mesurées sans et avec appareils", () => {
    const a = emptyAudiometry();
    a.freeField.unaided = { "500": { value: 40, confidence: "high" }, "1000": { value: 45, confidence: "high" }, "2000": { value: null, confidence: "high", noResponse: true } };
    a.freeField.aided = { "500": { value: 25, confidence: "high" }, "2000": { value: 30, confidence: "high" } };
    expect(gainBands(a.freeField.unaided, a.freeField.aided)).toEqual([{ freq: 500, aided: 25, unaided: 40 }]);
  });

  it("formate les fréquences et les écarts", () => {
    expect(freqLong("750")).toBe("750 Hz");
    expect(freqLong("1500")).toBe("1,5 kHz");
    expect(freqLong(8000)).toBe("8 kHz");
    expect(formatSigned(20)).toBe("+20");
    expect(formatSigned(-3.5)).toBe("−3,5");
    expect(formatSigned(0)).toBe("0");
  });
});
