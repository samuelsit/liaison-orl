import { describe, expect, it } from "vitest";
import { applyLearnedDefaults, emptyCompteRendu, learnFrom, mostFrequent } from "./defaults";

describe("valeurs mémorisées", () => {
  it("retient la valeur la plus fréquente à partir de 2 occurrences", () => {
    expect(mostFrequent({ deviceBrand: { signia: 1 } }, "deviceBrand")).toBeNull();
    expect(mostFrequent({ deviceBrand: { signia: 3, starkey: 2 } }, "deviceBrand")).toBe("signia");
  });

  it("apprend des comptes rendus validés et pré-remplit les suivants", () => {
    let learned = {};
    const cr = { ...emptyCompteRendu("2026-10-17"), deviceBrand: "starkey" as const, deviceClass: "2" as const, rechargeable: true };
    learned = learnFrom(learned, cr);
    learned = learnFrom(learned, cr);
    const next = applyLearnedDefaults(emptyCompteRendu("2026-10-18"), learned);
    expect(next.deviceBrand).toBe("starkey");
    expect(next.deviceClass).toBe("2");
    expect(next.rechargeable).toBe(true);
    expect(next.customEarmolds).toBeNull();
  });
});
