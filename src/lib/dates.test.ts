import { describe, expect, it } from "vitest";
import { dateGroup, formatFullDateTime, formatShortDate } from "./dates";

// Dimanche 18 octobre 2026, 12:00 à Paris (UTC+2).
const NOW = new Date("2026-10-18T10:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;
/** Intl insère des espaces insécables (« 5 min ») : on les normalise pour comparer. */
const short = (date: Date | string) => formatShortDate(date, NOW).replace(/\s/g, " ");
const HOUR = 60 * MIN;

describe("formatShortDate", () => {
  it("affiche « à l'instant » sous 45 secondes", () => {
    expect(formatShortDate(ago(20_000), NOW)).toBe("à l'instant");
  });

  it("compte en minutes puis en heures le jour même", () => {
    expect(short(ago(5 * MIN))).toBe("il y a 5 min");
    expect(short(ago(3 * HOUR))).toBe("il y a 3 h");
  });

  it("raisonne en jours calendaires (Paris) au-delà du jour même", () => {
    // Samedi 23:30 à Paris, 12 h 30 plus tôt : « hier », pas « il y a 12 h ».
    expect(formatShortDate(new Date("2026-10-17T21:30:00Z"), NOW)).toBe("hier");
    expect(formatShortDate(new Date("2026-10-16T08:00:00Z"), NOW)).toBe("avant-hier");
    expect(formatShortDate(new Date("2026-10-13T08:00:00Z"), NOW)).toBe("il y a 5 jours");
  });

  it("passe à une date absolue courte à partir de 7 jours", () => {
    expect(formatShortDate(new Date("2026-10-09T21:25:00Z"), NOW)).toBe("9 oct.");
    expect(formatShortDate("2026-01-02T09:00:00Z", NOW)).toBe("2 janv.");
  });

  it("ajoute l'année hors de l'année en cours", () => {
    expect(formatShortDate(new Date("2025-10-09T21:25:00Z"), NOW)).toBe("9 oct. 2025");
  });

  it("gère les dates futures et invalides", () => {
    expect(short(new Date(NOW.getTime() + 10 * MIN))).toBe("dans 10 min");
    expect(formatShortDate("pas une date", NOW)).toBe("");
  });
});

describe("formatFullDateTime", () => {
  it("donne la date complète à l'heure de Paris", () => {
    expect(formatFullDateTime("2026-10-09T21:25:00Z")).toBe("vendredi 9 octobre 2026 à 23:25");
  });
});

describe("dateGroup", () => {
  it("classe en aujourd'hui / cette semaine / plus ancien", () => {
    expect(dateGroup(ago(2 * HOUR), NOW)).toBe("today");
    // Lundi 12 octobre 2026 : début de la semaine en cours.
    expect(dateGroup(new Date("2026-10-12T06:00:00Z"), NOW)).toBe("week");
    // Dimanche 11 octobre 2026 : semaine précédente.
    expect(dateGroup(new Date("2026-10-11T20:00:00Z"), NOW)).toBe("older");
  });

  it("compte un lundi comme « aujourd'hui » et non « cette semaine »", () => {
    const monday = new Date("2026-10-19T10:00:00Z");
    expect(dateGroup(new Date("2026-10-19T05:00:00Z"), monday)).toBe("today");
    expect(dateGroup(new Date("2026-10-18T10:00:00Z"), monday)).toBe("older");
  });
});
