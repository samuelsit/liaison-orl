import type { Transition, Variants } from "motion/react";

/*
 * Préréglages d'animation partagés (cf. design §6). Les animations restent
 * discrètes (≤ 240 ms) et sont neutralisées par <MotionConfig reducedMotion="user">
 * quand le système demande de réduire les animations.
 */

/** Courbe d'entrée (équivalent CSS : `ease-out-soft`). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Courbe de sortie (équivalent CSS : `ease-in-soft`). */
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** Durées en secondes. */
export const DURATION = {
  /** Survol, appui, couleur. */
  fast: 0.12,
  /** Popover, infobulle, bascules, éléments de liste. */
  base: 0.18,
  /** Dialogues, panneaux, barres qui apparaissent. */
  slow: 0.22,
  /** Toute sortie. */
  exit: 0.15,
} as const;

/** Ressort des pastilles actives (contrôle segmenté, onglets, navigation). */
export const LAYOUT_SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 } as const satisfies Transition;

/** Barres flottantes (SaveBar, barre de sélection, barre d'action mobile) : y 16 → 0 avec fondu. */
export const barMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
  exit: { opacity: 0, y: 16, transition: { duration: DURATION.exit, ease: EASE_IN } },
} as const;

/** Fondu enchaîné (indicateur d'enregistrement, squelette → contenu). */
export const fadeMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.exit, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DURATION.exit, ease: EASE_IN } },
} as const;

/** Nombre de lignes animées à l'affichage d'une liste ; les suivantes apparaissent sans délai. */
export const LIST_STAGGER_LIMIT = 8;

/**
 * Apparition des lignes d'une liste au premier affichage (opacité + y 4 → 0, décalage 25 ms).
 * Usage : `<motion.li custom={index} variants={listItemVariants} initial="hidden" animate="visible" exit="removed" />`.
 * Ne pas rejouer sur un changement de filtre : garder des `key` stables.
 */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT, delay: index < LIST_STAGGER_LIMIT ? index * 0.025 : 0 },
  }),
  /** Suppression (archivage…) : la ligne se replie, 160 ms. */
  removed: { opacity: 0, height: 0, transition: { duration: 0.16, ease: EASE_IN } },
};

/** Appui sur une grande tuile d'action. */
export const TAP_SCALE = { scale: 0.98 } as const;
