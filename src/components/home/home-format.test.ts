import { describe, expect, it } from "vitest";
import { homeDateLine, homeGreeting, parisHour } from "./home-format";
import { shellFr } from "@/lib/i18n/shell";
import { isFocusedTaskPath } from "@/components/layout/mobile-tab-bar";
import { matchesQuery } from "@/components/layout/command-palette";

describe("accueil : salutation et date", () => {
  it("utilise l'heure de Paris", () => {
    // 16:30 UTC = 18:30 à Paris (heure d'été).
    expect(parisHour(new Date("2026-07-10T16:30:00Z"))).toBe(18);
    expect(parisHour(new Date("2026-01-10T07:00:00Z"))).toBe(8);
  });

  it("dit bonjour avant 18 h et bonsoir ensuite", () => {
    expect(homeGreeting("Claire", new Date("2026-10-18T08:00:00Z"))).toBe("Bonjour Claire");
    expect(homeGreeting("Claire", new Date("2026-10-18T15:59:00Z"))).toBe("Bonjour Claire");
    expect(homeGreeting("Claire", new Date("2026-10-18T16:00:00Z"))).toBe("Bonsoir Claire");
  });

  it("affiche le jour avec une majuscule", () => {
    expect(homeDateLine(new Date("2026-10-18T10:00:00Z"))).toBe("Dimanche 18 octobre");
  });
});

describe("libellés de la coquille", () => {
  it("accorde les compteurs au singulier et au pluriel", () => {
    expect(shellFr.sidebar.draftsBadge(1)).toBe("1 brouillon à finir");
    expect(shellFr.sidebar.draftsBadge(4)).toBe("4 brouillons à finir");
    expect(shellFr.sidebar.errorsBadge(1)).toBe("1 erreur d'envoi");
    expect(shellFr.sidebar.errorsBadge(3)).toBe("3 erreurs d'envoi");
    expect(shellFr.home.errorsDescription(1)).toBe("Un envoi demande une correction.");
    expect(shellFr.home.errorsDescription(2)).toBe("2 envois demandent une correction.");
  });

  it("adresse « au Dr » / « au Pr », sinon « à »", () => {
    expect(shellFr.palette.referTo("Dr", "Dr Marc DUBOIS")).toBe("Adresser un patient au Dr Marc DUBOIS");
    expect(shellFr.palette.referTo("Pr", "Pr Anne ROY")).toBe("Adresser un patient au Pr Anne ROY");
    expect(shellFr.palette.referTo("Mme", "Mme Lise PETIT")).toBe("Adresser un patient à Mme Lise PETIT");
  });
});

describe("barre d'onglets mobile", () => {
  it("est masquée sur l'éditeur et le récapitulatif d'envoi seulement", () => {
    expect(isFocusedTaskPath("/documents/abc")).toBe(true);
    expect(isFocusedTaskPath("/documents/abc/envoi")).toBe(true);
    expect(isFocusedTaskPath("/documents")).toBe(false);
    expect(isFocusedTaskPath("/")).toBe(false);
    expect(isFocusedTaskPath("/envois/abc")).toBe(false);
  });
});

describe("palette : filtre des actions", () => {
  it("ignore accents et casse, exige chaque mot", () => {
    expect(matchesQuery("", "Nouvel adressage")).toBe(true);
    expect(matchesQuery("adres", "Nouvel adressage")).toBe(true);
    expect(matchesQuery("theme", "Passer en mode sombre", "thème apparence")).toBe(true);
    expect(matchesQuery("admin stat", "Statistiques", "Administration")).toBe(true);
    expect(matchesQuery("durand", "Nouvel adressage")).toBe(false);
  });
});
