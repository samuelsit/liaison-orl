import { describe, expect, it } from "vitest";
import type { DispatchListItem, DocumentListItem } from "@/server/services/hydrate";
import { activityStats, buildActivity, sortDispatches } from "./activity";
import { highlightRanges, pageRange, patientPrefillFromQuery, personInitials } from "./utils";

describe("personInitials", () => {
  it("prend la première lettre du prénom puis du nom, en majuscules", () => {
    expect(personInitials("jeanne", "Durand")).toBe("JD");
    expect(personInitials("Émilie", "faure")).toBe("ÉF");
  });

  it("ignore la ponctuation et tolère les champs vides", () => {
    expect(personInitials("", "Lefèvre")).toBe("L");
    expect(personInitials("  ", "  ")).toBe("?");
    expect(personInitials("'Anne", "d'Arc")).toBe("AD");
  });
});

describe("patientPrefillFromQuery", () => {
  it("met le dernier mot en prénom et le reste en nom", () => {
    expect(patientPrefillFromQuery("durand jeanne")).toEqual({ lastName: "durand", firstName: "jeanne" });
    expect(patientPrefillFromQuery("de la tour marie")).toEqual({ lastName: "de la tour", firstName: "marie" });
  });

  it("garde un mot seul comme nom", () => {
    expect(patientPrefillFromQuery("  martin ")).toEqual({ lastName: "martin" });
    expect(patientPrefillFromQuery("")).toEqual({});
  });

  it("reconnaît une date de naissance", () => {
    expect(patientPrefillFromQuery("12/03/1946")).toEqual({ birthDate: "1946-03-12" });
    expect(patientPrefillFromQuery("31/02/1946")).toEqual({});
  });
});

describe("pageRange", () => {
  it("calcule la plage affichée et la navigation", () => {
    expect(pageRange(1, 50, 245)).toEqual({ page: 1, pages: 5, from: 1, to: 50, hasPrevious: false, hasNext: true });
    expect(pageRange(5, 50, 245)).toMatchObject({ from: 201, to: 245, hasPrevious: true, hasNext: false });
  });

  it("borne la page demandée et gère une liste vide", () => {
    expect(pageRange(9, 50, 60)).toMatchObject({ page: 2, from: 51, to: 60 });
    expect(pageRange(1, 50, 0)).toMatchObject({ page: 1, pages: 1, from: 0, to: 0, hasNext: false });
  });
});

describe("highlightRanges", () => {
  const marked = (text: string, q: string) => highlightRanges(text, q).map(([a, b]) => text.slice(a, b));

  it("surligne le début des mots, sans tenir compte de la casse ni des accents", () => {
    expect(marked("Dr Paul VASSEUR", "vass")).toEqual(["VASS"]);
    expect(marked("Clinique de l'Estrée", "estree")).toEqual(["Estrée"]);
    expect(marked("Évreux", "evr")).toEqual(["Évr"]);
  });

  it("ignore les correspondances au milieu d'un mot", () => {
    expect(marked("Dr Marc DUBOIS", "bois")).toEqual([]);
  });

  it("gère plusieurs mots et fusionne les plages qui se chevauchent", () => {
    expect(marked("93400 Saint-Ouen-sur-Seine", "saint ouen")).toEqual(["Saint", "Ouen"]);
    expect(highlightRanges("Durand", "d du")).toEqual([[0, 2]]);
  });

  it("ne renvoie rien sans requête", () => {
    expect(highlightRanges("Durand", "  ")).toEqual([]);
  });
});

const doc = (id: string, updatedAt: string, patientName: string | null = "Mme Jeanne DURAND"): DocumentListItem => ({
  id,
  type: "ADRESSAGE",
  status: "ENVOYE",
  patientName,
  prescriberName: "Dr Hélène GARNIER",
  authorName: "Claire MOREL",
  centreId: "c1",
  updatedAt,
  version: 1,
});

const dispatch = (id: string, documentId: string, status: DispatchListItem["status"], at: string): DispatchListItem => ({
  id,
  documentId,
  documentType: "ADRESSAGE",
  channel: "EMAIL",
  status,
  recipientName: "Dr Hélène GARNIER",
  patientName: "Mme Jeanne DURAND",
  error: null,
  costCents: null,
  mock: true,
  createdAt: at,
  updatedAt: at,
});

describe("buildActivity", () => {
  it("groupe les documents par mois (heure de Paris), du plus récent au plus ancien", () => {
    const { groups } = buildActivity(
      [doc("a", "2026-09-30T21:30:00Z"), doc("b", "2026-10-09T10:00:00Z"), doc("c", "2026-09-02T10:00:00Z")],
      [],
    );
    // 30 septembre, 21 h 30 UTC = 23 h 30 à Paris : reste en septembre.
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.doc.id)])).toEqual([
      ["Octobre 2026", ["b"]],
      ["Septembre 2026", ["a", "c"]],
    ]);
  });

  it("rattache les envois à leur document, erreurs en tête, et isole les envois orphelins", () => {
    const { groups, orphans } = buildActivity(
      [doc("a", "2026-10-09T10:00:00Z")],
      [
        dispatch("d1", "a", "opened", "2026-10-09T12:00:00Z"),
        dispatch("d2", "a", "bounced", "2026-10-09T11:00:00Z"),
        dispatch("d3", "zzz", "delivered", "2026-10-01T11:00:00Z"),
      ],
    );
    expect(groups[0]!.entries[0]!.dispatches.map((d) => d.id)).toEqual(["d2", "d1"]);
    expect(orphans.map((d) => d.id)).toEqual(["d3"]);
  });
});

describe("sortDispatches / activityStats", () => {
  it("trie par date décroissante à statut égal", () => {
    const sorted = sortDispatches([dispatch("x", "a", "sent", "2026-10-01T10:00:00Z"), dispatch("y", "a", "sent", "2026-10-02T10:00:00Z")]);
    expect(sorted.map((d) => d.id)).toEqual(["y", "x"]);
  });

  it("compte les documents, les patients distincts et le dernier envoi", () => {
    const stats = activityStats(
      [doc("a", "2026-10-01T10:00:00Z"), doc("b", "2026-10-02T10:00:00Z"), doc("c", "2026-10-03T10:00:00Z", "M. Robert MARTIN"), doc("d", "2026-10-03T10:00:00Z", null)],
      [dispatch("x", "a", "sent", "2026-10-01T10:00:00Z"), dispatch("y", "b", "sent", "2026-10-05T10:00:00Z")],
    );
    expect(stats).toEqual({ documents: 4, patients: 2, lastDispatchAt: "2026-10-05T10:00:00Z" });
    expect(activityStats([], []).lastDispatchAt).toBeNull();
  });
});
