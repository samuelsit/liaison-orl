import { describe, expect, it } from "vitest";
import { groupByDate, pageSize } from "./list-utils";

// Vendredi 16 octobre 2026, 15 h à Paris.
const NOW = new Date("2026-10-16T13:00:00.000Z");

describe("groupByDate", () => {
  it("regroupe par période en conservant l'ordre", () => {
    const items = [
      { id: "a", at: "2026-10-16T12:00:00.000Z" },
      { id: "b", at: "2026-10-16T07:00:00.000Z" },
      { id: "c", at: "2026-10-13T09:00:00.000Z" },
      { id: "d", at: "2026-10-01T09:00:00.000Z" },
    ];
    const groups = groupByDate(items, (i) => i.at, NOW);
    expect(groups.map((g) => g.key)).toEqual(["today", "week", "older"]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["a", "b"], ["c"], ["d"]]);
  });

  it("une période n'apparaît qu'une fois même si la liste n'est pas strictement triée", () => {
    const items = [
      { id: "a", at: "2026-10-16T12:00:00.000Z" },
      { id: "b", at: "2026-10-01T09:00:00.000Z" },
      { id: "c", at: "2026-10-16T08:00:00.000Z" },
    ];
    expect(groupByDate(items, (i) => i.at, NOW).map((g) => g.key)).toEqual(["today", "older"]);
  });

  it("liste vide", () => {
    expect(groupByDate([], () => "", NOW)).toEqual([]);
  });
});

describe("pageSize", () => {
  it("50 par défaut ou pour une valeur invalide", () => {
    expect(pageSize(undefined)).toBe(50);
    expect(pageSize("abc")).toBe(50);
    expect(pageSize("-4")).toBe(50);
  });
  it("arrondit au pas de 50 supérieur et plafonne à 500", () => {
    expect(pageSize("100")).toBe(100);
    expect(pageSize("120")).toBe(150);
    expect(pageSize("5000")).toBe(500);
  });
});
