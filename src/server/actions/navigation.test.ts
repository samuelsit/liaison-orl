import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import type { SessionUser } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";

/* Session, cookies et revalidation simulés : on teste la règle et la persistance de la préférence. */
const state = vi.hoisted(() => ({ user: null as SessionUser | null, cookie: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: (name: string, value: string) => state.cookie.set(name, value), get: (name: string) => ({ value: state.cookie.get(name) }) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireUserOrThrow: async () => state.user! };
});

const { setActiveCentreAction } = await import("./navigation");

setupTestDb();
beforeEach(() => state.cookie.clear());

async function prefs(userId: string) {
  return (await collections().users().findOne({ _id: userId }))!.preferences;
}

describe("setActiveCentreAction : vue « Tous les centres »", () => {
  it("est acceptée pour un administrateur sans écraser le dernier centre réel", async () => {
    const { org, centres } = await createTestOrg({ centres: 3 });
    const ctx = await createTestContext(org, centres, { role: "admin" });
    state.user = ctx.user;
    expect((await setActiveCentreAction(centres[1]!._id)).ok).toBe(true);
    expect((await setActiveCentreAction("tous")).ok).toBe(true);
    expect(state.cookie.get("lorl_centre")).toBe("tous");
    expect(await prefs(ctx.user.id)).toMatchObject({ activeCentreId: centres[1]!._id, viewAllCentres: true });
    // Retour à un centre précis : la vue d'ensemble est quittée.
    expect((await setActiveCentreAction(centres[2]!._id)).ok).toBe(true);
    expect(await prefs(ctx.user.id)).toMatchObject({ activeCentreId: centres[2]!._id, viewAllCentres: false });
  });

  it("est refusée aux audioprothésistes, aux assistantes et à un administrateur d'un seul centre", async () => {
    const { org, centres } = await createTestOrg({ centres: 2 });
    for (const role of ["audioprothesiste", "assistant"] as const) {
      state.user = (await createTestContext(org, centres, { role })).user;
      const res = await setActiveCentreAction("tous");
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/réservée aux administrateurs/);
    }
    const single = await createTestOrg({ centres: 1 });
    state.user = (await createTestContext(single.org, single.centres, { role: "admin" })).user;
    expect((await setActiveCentreAction("tous")).ok).toBe(false);
    expect(state.cookie.size).toBe(0);
  });
});
