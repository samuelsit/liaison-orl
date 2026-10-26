"use client";

import { useId } from "react";
import { ArrowRight, ClipboardList, FileText, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Shortcut } from "@/components/ui/shortcut";
import { shellFr } from "@/lib/i18n/shell";
import { DURATION, EASE_OUT, TAP_SCALE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/lib/schemas/document";

export const CREATE_TILES = {
  ADRESSAGE: {
    label: shellFr.create.adressage,
    hint: shellFr.create.adressageHint,
    hintShort: shellFr.create.adressageHintShort,
    icon: FileText,
    shortcut: "a",
  },
  COMPTE_RENDU: {
    label: shellFr.create.compteRendu,
    hint: shellFr.create.compteRenduHint,
    hintShort: shellFr.create.compteRenduHintShort,
    icon: ClipboardList,
    shortcut: "c",
  },
} as const satisfies Record<DocumentType, { label: string; hint: string; hintShort: string; icon: unknown; shortcut: string }>;

/**
 * Tuile de création (accueil, feuille « Créer ») : carte blanche, pastille de marque,
 * titre et aide. Le nom accessible est le titre ; l'aide sert de description.
 * Pendant la création, l'indicateur remplace l'icône de la seule tuile cliquée.
 */
export function CreateTile({
  type,
  index = 0,
  busy,
  disabled,
  onCreate,
  testId,
  variant = "home",
}: {
  type: DocumentType;
  index?: number;
  /** Cette tuile est en cours de création. */
  busy: boolean;
  /** Une création (quelle qu'elle soit) est en cours. */
  disabled: boolean;
  onCreate: () => void;
  testId: string;
  /** `home` : aide visible dès sm ; `sheet` : aide courte toujours visible (feuille mobile). */
  variant?: "home" | "sheet";
}) {
  const tile = CREATE_TILES[type];
  const Icon = tile.icon;
  const titleId = useId();
  const hintId = useId();
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: DURATION.base, ease: EASE_OUT }}
      whileTap={disabled ? undefined : TAP_SCALE}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-labelledby={titleId}
      aria-describedby={hintId}
      aria-keyshortcuts={variant === "home" ? tile.shortcut.toUpperCase() : undefined}
      onClick={onCreate}
      data-testid={testId}
      className={cn(
        "group relative flex min-w-0 flex-col items-start gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left shadow-xs outline-none",
        "transition-[border-color,box-shadow] duration-150 hover:border-foreground/20 hover:shadow-md",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
        "disabled:cursor-wait disabled:hover:shadow-xs",
        // Filet d'accent (couleur secondaire de la marque) révélé au survol : purement décoratif.
        "before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-brand-accent before:opacity-0 before:transition-opacity hover:before:opacity-100",
        variant === "home" && "min-h-24 sm:flex-row sm:items-center sm:gap-4 sm:p-5",
        variant === "sheet" && "min-h-28",
      )}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs [&_svg]:size-5"
      >
        {busy ? <Loader2 className="animate-spin" /> : <Icon />}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span id={titleId} className="block text-[15px] leading-5 font-semibold tracking-tight text-foreground sm:text-base">
          {tile.label}
        </span>
        <span
          id={hintId}
          className={cn(
            "block text-meta text-muted-foreground",
            variant === "home" ? "max-sm:sr-only" : undefined,
          )}
        >
          {busy ? shellFr.create.creating : variant === "home" ? tile.hint : tile.hintShort}
        </span>
      </span>
      {variant === "home" ? (
        <span aria-hidden className="ml-auto hidden shrink-0 items-center gap-3 sm:flex">
          <Shortcut keys={[tile.shortcut]} />
          <ArrowRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
      ) : null}
    </motion.button>
  );
}
