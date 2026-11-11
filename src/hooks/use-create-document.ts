"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createDocumentAction } from "@/server/actions/documents";
import type { DocumentType } from "@/lib/schemas/document";
import { shellFr } from "@/lib/i18n/shell";
import { centreRequests, useCentreScope } from "@/components/layout/centre-scope";

export interface CreateOptions {
  patientId?: string | null;
  prescriberId?: string | null;
  /** Centre du document ; demandé à l'utilisateur en vue « Tous les centres » sans patient. */
  centreId?: string | null;
}

/** Vue « Tous les centres » : sans patient (dont le centre fait foi) ni centre explicite, il faut demander. */
export function needsCentreChoice(allCentres: boolean, opts: CreateOptions): boolean {
  return allCentres && !opts.patientId && !opts.centreId;
}

/*
 * Garde globale de création : un seul brouillon à la fois, quel que soit le déclencheur
 * (tuiles de l'accueil, raccourcis A / C, palette, menu « Nouveau », barre d'onglets).
 * Un double clic ou une touche répétée ne crée donc jamais deux brouillons vides.
 * La garde se libère quand l'éditeur s'ouvre (changement d'adresse), en cas d'erreur,
 * ou au plus tard après SAFETY_MS si la navigation n'aboutit pas.
 */

export interface CreateGuardState {
  type: DocumentType | null;
  /** Adresse au moment du clic : la garde tombe dès qu'on l'a quittée. */
  fromPath: string | null;
  startedAt: number;
}

const IDLE: CreateGuardState = { type: null, fromPath: null, startedAt: 0 };
export const CREATE_GUARD_SAFETY_MS = 20_000;
const SAFETY_MS = CREATE_GUARD_SAFETY_MS;

/** Magasin minimal (testable) : état, abonnement et transitions de la garde. */
export function createGuardStore() {
  let state: CreateGuardState = IDLE;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Vrai si la création peut démarrer (et la réserve) ; faux si une création est déjà en cours. */
    acquire(type: DocumentType, fromPath: string, now = Date.now()): boolean {
      if (state.type && now - state.startedAt < SAFETY_MS) return false;
      state = { type, fromPath, startedAt: now };
      emit();
      return true;
    },
    release() {
      if (!state.type) return;
      state = IDLE;
      emit();
    },
    /** Filet de sécurité : libère une garde restée bloquée (navigation interrompue). */
    releaseStale(now = Date.now()) {
      if (state.type && now - state.startedAt >= SAFETY_MS) {
        state = IDLE;
        emit();
      }
    },
    /** Libère la garde lorsque l'utilisateur a changé de page depuis le clic. */
    releaseIfLeft(pathname: string) {
      if (state.type && state.fromPath !== pathname) {
        state = IDLE;
        emit();
      }
    },
  };
}

const guard = createGuardStore();
const getServerSnapshot = () => IDLE;

/** Crée immédiatement un brouillon (sauvegarde dès la première seconde) puis ouvre l'éditeur. */
export function useCreateDocument() {
  const router = useRouter();
  const pathname = usePathname();
  const state = useSyncExternalStore(guard.subscribe, guard.get, getServerSnapshot);
  const { allCentres } = useCentreScope();

  useEffect(() => {
    guard.releaseIfLeft(pathname);
  }, [pathname]);

  const create = useCallback(
    function run(type: DocumentType, opts: CreateOptions = {}) {
      if (needsCentreChoice(allCentres, opts)) {
        // La garde n'est prise qu'après le choix : fermer la fenêtre n'a rien à libérer.
        if (!guard.get().type) centreRequests.open({ type, onPick: (centreId) => run(type, { ...opts, centreId }) });
        return;
      }
      if (!guard.acquire(type, pathname)) return;
      setTimeout(() => guard.releaseStale(), SAFETY_MS + 50);
      void (async () => {
        try {
          const res = await createDocumentAction(type, opts);
          if (!res.ok) {
            guard.release();
            toast.error(res.error);
            return;
          }
          router.push(`/documents/${res.data.id}`);
        } catch {
          guard.release();
          toast.error(shellFr.create.failed);
        }
      })();
    },
    [allCentres, pathname, router],
  );

  const needsCentre = useCallback((opts: CreateOptions = {}) => needsCentreChoice(allCentres, opts), [allCentres]);

  return { create, needsCentre, pending: state.type !== null, pendingType: state.type };
}
