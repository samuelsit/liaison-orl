"use client";

import { useEffect, useRef } from "react";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.getAttribute("role") === "combobox";
}

/** Vrai si la touche est frappée dans une fenêtre, un menu ou une liste ouverte (les lettres y ont leur propre rôle). */
export function isInOverlay(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]') !== null;
}

/** Identifiant d'une frappe : « mod+k », « shift+enter », « a », « ? ». */
export function hotkeyId(e: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "key">): string {
  const mod = e.metaKey || e.ctrlKey;
  return `${mod ? "mod+" : ""}${e.shiftKey && e.key.length > 1 ? "shift+" : ""}${e.key.toLowerCase()}`;
}

export const SEQUENCE_WINDOW_MS = 800;

export interface PendingSequence {
  key: string;
  at: number;
}

/**
 * Résout une frappe en tenant compte des séquences à deux touches (« g d ») :
 * la seconde touche, dans la fenêtre de 800 ms, l'emporte sur son raccourci isolé
 * (« g » puis « c » ouvre Mon compte ; « c » seul crée un compte rendu).
 */
export function resolveHotkey(
  id: string,
  prev: PendingSequence | null,
  now: number,
  keys: readonly string[],
  windowMs = SEQUENCE_WINDOW_MS,
): { match: string | null; pending: PendingSequence | null } {
  if (prev && now - prev.at <= windowMs) {
    const seq = `${prev.key} ${id}`;
    if (keys.includes(seq)) return { match: seq, pending: null };
  }
  const isPrefix = keys.some((k) => k.startsWith(`${id} `));
  return {
    match: keys.includes(id) ? id : null,
    pending: isPrefix ? { key: id, at: now } : null,
  };
}

/**
 * Raccourcis clavier globaux ; ignorés pendant la saisie et dans les fenêtres ouvertes,
 * sauf combinaison avec Ctrl/Cmd. Les clés « g d » décrivent des séquences de deux touches.
 */
export function useHotkeys(handlers: Record<string, (e: KeyboardEvent) => void>, deps: unknown[] = []) {
  const pending = useRef<PendingSequence | null>(null);
  useEffect(() => {
    const keys = Object.keys(handlers);
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.isComposing) return;
      const id = hotkeyId(e);
      const mod = id.startsWith("mod+");
      // Touche maintenue : seules les combinaisons (Ctrl/⌘ + S…) restent interceptées.
      if (e.repeat && !mod) return;
      if (!mod && (isEditableTarget(e.target) || isInOverlay(e.target))) {
        pending.current = null;
        return;
      }
      const { match, pending: next } = resolveHotkey(id, pending.current, Date.now(), keys);
      pending.current = next;
      if (!match) return;
      handlers[match]?.(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
