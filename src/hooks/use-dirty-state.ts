"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Valeur de formulaire en état local avec détection des modifications (comparaison
 * JSON avec une référence). `reset()` annule, `commit()` adopte la valeur enregistrée.
 * Si la valeur initiale change (router.refresh) sans modification en cours, elle est reprise.
 */
export function useDirtyState<T>(initial: T) {
  const initialKey = JSON.stringify(initial);
  const [baseline, setBaseline] = useState(initial);
  const [baselineKey, setBaselineKey] = useState(initialKey);
  const [value, setValue] = useState(initial);
  const [prevInitialKey, setPrevInitialKey] = useState(initialKey);
  const dirty = JSON.stringify(value) !== baselineKey;

  if (initialKey !== prevInitialKey) {
    setPrevInitialKey(initialKey);
    if (!dirty) {
      setBaseline(initial);
      setBaselineKey(initialKey);
      setValue(initial);
    }
  }

  const reset = useCallback(() => setValue(baseline), [baseline]);
  /** Après enregistrement : la valeur (courante par défaut) devient la référence. */
  const commit = useCallback(
    (saved: T = value) => {
      setBaseline(saved);
      setBaselineKey(JSON.stringify(saved));
      setValue(saved);
    },
    [value],
  );

  return { value, setValue, dirty, reset, commit };
}

/** Demande confirmation avant de quitter / recharger la page tant que `dirty` est vrai. */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Anciens navigateurs : une valeur non vide déclenche la confirmation.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
