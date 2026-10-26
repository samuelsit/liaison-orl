import { describe, expect, it } from "vitest";
import { findDuplicateGroups, mergeFields } from "./dedupe";
import { mapHeader, parsePrescriberRows } from "./csv";

const p = (id: string, over: Partial<{ lastName: string; firstName: string; rpps: string; email: string; cp: string }> = {}) => ({
  _id: id,
  lastName: over.lastName ?? "Dupont",
  firstName: over.firstName ?? "Jean",
  rpps: over.rpps ?? "",
  email: over.email ?? "",
  address: { postalCode: over.cp ?? "75001" },
});

describe("dédoublonnage", () => {
  it("regroupe par nom + code postal, RPPS ou e-mail (transitivement)", () => {
    const groups = findDuplicateGroups([
      p("a"),
      p("b", { lastName: "DUPONT", firstName: "jean" }),
      p("c", { lastName: "Martin", rpps: "10000000001" }),
      p("d", { lastName: "Martinez", rpps: "10000000001", email: "x@y.test" }),
      p("e", { lastName: "Autre", email: "x@y.test" }),
      p("f", { lastName: "Seul" }),
    ]);
    const ids = groups.map((g) => g.map((i) => i._id).sort().join(","));
    expect(ids).toContain("a,b");
    expect(ids).toContain("c,d,e");
    expect(ids.some((s) => s.includes("f"))).toBe(false);
  });

  it("ne rapproche pas des homonymes de villes différentes", () => {
    expect(findDuplicateGroups([p("a", { cp: "75001" }), p("b", { cp: "76000" })])).toHaveLength(0);
  });

  it("complète la fiche principale avec les champs vides", () => {
    const patch = mergeFields({ email: "", phone: "01" }, [{ email: "a@b.test", phone: "02" }], ["email", "phone"]);
    expect(patch).toEqual({ email: "a@b.test" });
  });
});

describe("import CSV", () => {
  it("reconnaît les en-têtes usuels", () => {
    expect(mapHeader("Code postal")).toBe("postalCode");
    expect(mapHeader("Prénom")).toBe("firstName");
    expect(mapHeader("E-mail")).toBe("email");
    expect(mapHeader("inconnu")).toBeNull();
  });

  it("valide et normalise les lignes", () => {
    const res = parsePrescriberRows([
      { Civilité: "Pr", Nom: "Martin", Prénom: "Anne", Ville: "Rouen", "Code postal": "76 000", Email: "A.Martin@CHU.test", Canal: "courrier" },
      { Nom: "", Prénom: "Sans nom" },
      { Nom: "Durand", RPPS: "123" },
    ]);
    expect(res[0]).toMatchObject({ ok: true, value: { civility: "Pr", email: "a.martin@chu.test", preferredChannel: "courrier", address: { postalCode: "76000", country: "FRANCE" } } });
    expect(res[1]!.ok).toBe(false);
    expect(res[2]!.ok).toBe(false);
    expect(res[2]!.row).toBe(4);
  });
});
