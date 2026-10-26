"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraftAction } from "@/server/actions/documents";

export type SaveState = "saved" | "dirty" | "saving" | "error" | "offline";

const storageKey = (id: string) => `lorl:brouillon:${id}`;

interface Backup {
  payload: string;
  at: number;
}

export function readBackup(id: string): Backup | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

export function clearBackup(id: string) {
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // stockage indisponible (navigation privée)
  }
}

/**
 * Sauvegarde automatique : copie locale immédiate (aucune perte même hors ligne),
 * envoi au serveur après une courte pause de saisie, envoi de secours à la fermeture.
 */
export function useAutosave(id: string, payload: string, enabled: boolean, initialPayload: string) {
  const [state, setState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const lastSaved = useRef(initialPayload);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const body = pending.current;
    if (!body || body === lastSaved.current) return;
    pending.current = null;
    setState("saving");
    try {
      const res = await saveDraftAction(id, JSON.parse(body));
      if (res.ok) {
        lastSaved.current = body;
        setSavedAt(new Date(res.data.updatedAt));
        setState(pending.current ? "dirty" : "saved");
        clearBackup(id);
      } else {
        pending.current = body;
        setState("error");
      }
    } catch {
      pending.current = body;
      setState(navigator.onLine ? "error" : "offline");
    }
  }, [id]);

  useEffect(() => {
    if (!enabled || payload === lastSaved.current) return;
    pending.current = payload;
    try {
      localStorage.setItem(storageKey(id), JSON.stringify({ payload, at: Date.now() } satisfies Backup));
    } catch {
      // ignore
    }
    const t = setTimeout(() => {
      setState("dirty");
    }, 0);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
    return () => clearTimeout(t);
  }, [payload, enabled, id, flush]);

  useEffect(() => {
    function onUnload() {
      if (pending.current && pending.current !== lastSaved.current) {
        navigator.sendBeacon(`/api/documents/${id}/brouillon`, new Blob([pending.current], { type: "text/plain" }));
      }
    }
    function onOnline() {
      if (pending.current) void flush();
    }
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("online", onOnline);
    };
  }, [id, flush]);

  return { state, savedAt, flush };
}
