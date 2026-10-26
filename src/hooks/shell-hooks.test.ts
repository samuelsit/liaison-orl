import { describe, expect, it } from "vitest";
import { hotkeyId, resolveHotkey, SEQUENCE_WINDOW_MS } from "./use-hotkeys";
import { CREATE_GUARD_SAFETY_MS, createGuardStore } from "./use-create-document";

const KEYS = ["mod+k", "/", "a", "c", "?", "g h", "g d", "g c"] as const;

describe("hotkeyId", () => {
  it("normalise les combinaisons et les touches simples", () => {
    expect(hotkeyId({ metaKey: true, ctrlKey: false, shiftKey: false, key: "K" })).toBe("mod+k");
    expect(hotkeyId({ metaKey: false, ctrlKey: true, shiftKey: false, key: "Enter" })).toBe("mod+enter");
    expect(hotkeyId({ metaKey: false, ctrlKey: false, shiftKey: true, key: "?" })).toBe("?");
    expect(hotkeyId({ metaKey: false, ctrlKey: false, shiftKey: true, key: "Enter" })).toBe("shift+enter");
    expect(hotkeyId({ metaKey: false, ctrlKey: false, shiftKey: false, key: "a" })).toBe("a");
  });
});

describe("resolveHotkey", () => {
  it("déclenche un raccourci simple", () => {
    expect(resolveHotkey("a", null, 0, KEYS)).toEqual({ match: "a", pending: null });
    expect(resolveHotkey("mod+k", null, 0, KEYS)).toEqual({ match: "mod+k", pending: null });
  });

  it("mémorise le préfixe d'une séquence sans rien déclencher", () => {
    expect(resolveHotkey("g", null, 1000, KEYS)).toEqual({ match: null, pending: { key: "g", at: 1000 } });
  });

  it("« g » puis « c » dans la fenêtre ouvre la séquence, pas le raccourci « c »", () => {
    const first = resolveHotkey("g", null, 1000, KEYS);
    expect(resolveHotkey("c", first.pending, 1000 + SEQUENCE_WINDOW_MS - 1, KEYS)).toEqual({ match: "g c", pending: null });
  });

  it("« c » hors de la fenêtre reste le raccourci de création", () => {
    const first = resolveHotkey("g", null, 1000, KEYS);
    expect(resolveHotkey("c", first.pending, 1000 + SEQUENCE_WINDOW_MS + 1, KEYS).match).toBe("c");
  });

  it("une séquence inconnue est ignorée puis oubliée", () => {
    const first = resolveHotkey("g", null, 0, KEYS);
    const second = resolveHotkey("x", first.pending, 10, KEYS);
    expect(second).toEqual({ match: null, pending: null });
    expect(resolveHotkey("a", second.pending, 20, KEYS).match).toBe("a");
  });
});

describe("garde de création de document", () => {
  it("refuse une seconde création tant que la première est en cours", () => {
    const g = createGuardStore();
    expect(g.acquire("ADRESSAGE", "/", 0)).toBe(true);
    expect(g.acquire("ADRESSAGE", "/", 10)).toBe(false);
    expect(g.acquire("COMPTE_RENDU", "/", 20)).toBe(false);
    expect(g.get().type).toBe("ADRESSAGE");
  });

  it("se libère en cas d'erreur", () => {
    const g = createGuardStore();
    g.acquire("ADRESSAGE", "/", 0);
    g.release();
    expect(g.get().type).toBeNull();
    expect(g.acquire("COMPTE_RENDU", "/", 5)).toBe(true);
  });

  it("se libère quand l'éditeur s'ouvre (changement d'adresse), pas avant", () => {
    const g = createGuardStore();
    g.acquire("ADRESSAGE", "/", 0);
    g.releaseIfLeft("/");
    expect(g.get().type).toBe("ADRESSAGE");
    g.releaseIfLeft("/documents/abc");
    expect(g.get().type).toBeNull();
  });

  it("filet de sécurité : une garde bloquée tombe après le délai", () => {
    const g = createGuardStore();
    g.acquire("ADRESSAGE", "/", 0);
    g.releaseStale(CREATE_GUARD_SAFETY_MS - 1);
    expect(g.get().type).toBe("ADRESSAGE");
    g.releaseStale(CREATE_GUARD_SAFETY_MS);
    expect(g.get().type).toBeNull();
    expect(g.acquire("ADRESSAGE", "/", CREATE_GUARD_SAFETY_MS + 1)).toBe(true);
  });

  it("notifie les abonnés à chaque changement", () => {
    const g = createGuardStore();
    let calls = 0;
    const off = g.subscribe(() => calls++);
    g.acquire("ADRESSAGE", "/", 0);
    g.release();
    g.release();
    off();
    g.acquire("ADRESSAGE", "/", 0);
    expect(calls).toBe(2);
  });
});
