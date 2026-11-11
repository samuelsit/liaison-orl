import { describe, expect, it } from "vitest";
import { canViewAllCentres, withScope } from "./scope";
import { needsCentreChoice } from "@/hooks/use-create-document";
import { orderCentres } from "@/components/layout/centre-scope";

const centres = [{ _id: "c1" }, { _id: "c2" }, { _id: "c3" }];

describe("vue « Tous les centres »", () => {
  it("est réservée aux administrateurs d'une organisation à plusieurs centres", () => {
    expect(canViewAllCentres({ role: "admin" }, 3)).toBe(true);
    expect(canViewAllCentres({ role: "admin" }, 1)).toBe(false);
    expect(canViewAllCentres({ role: "audioprothesiste" }, 3)).toBe(false);
    expect(canViewAllCentres({ role: "assistant" }, 3)).toBe(false);
  });

  it("étend le périmètre des lectures à tous les centres, le centre actif restant réel", () => {
    const ctx = withScope({ user: { role: "admin" as const }, centres, activeCentre: centres[1]! }, true);
    expect(ctx.allCentres).toBe(true);
    expect(ctx.scopeCentreIds).toEqual(["c1", "c2", "c3"]);
    expect(ctx.activeCentre._id).toBe("c2");
  });

  it("ignore la demande pour un non-administrateur ou hors demande", () => {
    const audio = withScope({ user: { role: "audioprothesiste" as const }, centres, activeCentre: centres[0]! }, true);
    expect(audio).toMatchObject({ allCentres: false, scopeCentreIds: ["c1"] });
    const admin = withScope({ user: { role: "admin" as const }, centres, activeCentre: centres[2]! }, false);
    expect(admin).toMatchObject({ allCentres: false, scopeCentreIds: ["c3"] });
  });

  it("demande le centre d'un nouveau document seulement sans patient ni centre explicite", () => {
    expect(needsCentreChoice(true, {})).toBe(true);
    expect(needsCentreChoice(true, { prescriberId: "p" })).toBe(true);
    expect(needsCentreChoice(true, { patientId: "x" })).toBe(false);
    expect(needsCentreChoice(true, { centreId: "c1" })).toBe(false);
    expect(needsCentreChoice(false, {})).toBe(false);
  });

  it("propose le dernier centre utilisé en premier", () => {
    const list = [
      { id: "c1", name: "A" },
      { id: "c2", name: "B" },
      { id: "c3", name: "C" },
    ];
    expect(orderCentres(list, "c2")).toEqual({ last: list[1], others: [list[0], list[2]] });
    expect(orderCentres(list, "inconnu")).toEqual({ last: null, others: list });
  });
});
