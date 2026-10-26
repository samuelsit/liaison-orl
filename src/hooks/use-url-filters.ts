"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ParamPatch = Record<string, string | null | undefined>;

/** Applique un correctif de paramètres d'URL (null / undefined / "" suppriment la clé). */
export function patchSearchParams(current: URLSearchParams | string, patch: ParamPatch): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next;
}

/**
 * Filtres portés par l'URL (listes rendues côté serveur) : `href(patch)` pour un lien
 * (FilterChip), `update(patch)` pour un contrôle (SegmentedControl, Select). La navigation
 * remplace l'entrée d'historique sans remonter en haut de page ; `pending` suit le rendu serveur.
 * Par défaut, tout changement de filtre revient à la première page (`page` supprimé).
 */
export function useUrlFilters({ resetKeys = ["page"] }: { resetKeys?: string[] } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Clé stable : la liste littérale passée en option change d'identité à chaque rendu.
  const resetKey = resetKeys.join(",");
  const href = useCallback(
    (patch: ParamPatch) => {
      const reset = Object.fromEntries(
        resetKey
          .split(",")
          .filter((k) => k && !(k in patch))
          .map((k) => [k, null]),
      );
      const qs = patchSearchParams(params, { ...reset, ...patch }).toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname, resetKey],
  );

  const update = useCallback(
    (patch: ParamPatch) => {
      const target = href(patch);
      startTransition(() => router.replace(target, { scroll: false }));
    },
    [href, router],
  );

  return { params, href, update, pending };
}

/**
 * Recherche texte synchronisée avec l'URL après une courte pause de saisie.
 * Usage : `const search = useUrlSearchQuery(); <FilterSearch value={search.value} onValueChange={search.setValue} pending={search.pending} />`.
 */
export function useUrlSearchQuery(key = "q", { debounceMs = 250 }: { debounceMs?: number } = {}) {
  const { params, update, pending } = useUrlFilters();
  const urlValue = params.get(key) ?? "";
  /** Saisie en cours (null : l'URL fait foi). */
  const [local, setLocal] = useState<string | null>(null);
  /** Dernière valeur envoyée dans l'URL. */
  const [pushed, setPushed] = useState(urlValue);
  const [prevUrl, setPrevUrl] = useState(urlValue);

  // Navigation arrière ou lien externe : la nouvelle URL remplace la saisie.
  if (urlValue !== prevUrl) {
    setPrevUrl(urlValue);
    if (urlValue !== pushed) {
      setPushed(urlValue);
      setLocal(null);
    }
  }

  useEffect(() => {
    if (local === null || local.trim() === pushed) return;
    const t = setTimeout(() => {
      const next = local.trim();
      setPushed(next);
      update({ [key]: next || null });
    }, debounceMs);
    return () => clearTimeout(t);
  }, [local, pushed, key, debounceMs, update]);

  return { value: local ?? urlValue, setValue: setLocal as (value: string) => void, pending };
}
