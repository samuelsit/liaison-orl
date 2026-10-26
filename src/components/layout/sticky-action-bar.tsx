"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { barMotion, fadeMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { RowActionButton, RowActionMenu, type RowAction } from "./list-row-actions";

/*
 * Barres d'action collantes (cf. design §4.10). Règle : UN élément DOM par action.
 * Les barres changent de position selon la largeur, elles ne sont jamais dupliquées
 * (les data-testid restent uniques).
 *
 * Attention : un ancêtre avec transform, filter, backdrop-filter, contain ou
 * container-type devient le repère des éléments `position: fixed`. Ne pas placer
 * StickyActionBar dans un tel conteneur ; FloatingBar passe par un portail.
 */

const noopSubscribe = () => () => {};

/** Vrai après l'hydratation (les portails ont besoin de `document`). */
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Barre supérieure des écrans outils (éditeur, récapitulatif d'envoi).
 * ≥ lg : [Documents ›] [h1] [statut, version] [état d'enregistrement] … [outils] [actions secondaires] [action principale].
 * < lg : en haut [←] [h1 tronqué] [statut] [icône d'état] ; le groupe d'actions devient
 * une barre fixée en bas de l'écran ([⋯] [résumé] [principale pleine largeur]).
 */
export function StickyActionBar({
  back,
  title,
  meta,
  status,
  tools,
  secondaryActions = [],
  secondary,
  summary,
  primaryAction,
  className,
}: {
  back?: { href: string; label: string };
  /** Titre h1 de l'écran (police d'interface, 16 px) : le seul h1 de la page. */
  title: ReactNode;
  /** StatusBadge, « v2 »… */
  meta?: ReactNode;
  /** État d'enregistrement (ActionBarStatus), reste en haut sur mobile. */
  status?: ReactNode;
  /** Outils réservés au grand écran (bascule « Masquer l'aperçu »…). */
  tools?: ReactNode;
  /** Boutons icônes avec infobulle (≥ lg), menu ⋯ (< lg). */
  secondaryActions?: RowAction[];
  /** Boutons secondaires toujours visibles (outline), avant l'action principale. */
  secondary?: ReactNode;
  /** Texte d'accompagnement de l'action (coût « ≈ 1,44 € TTC », consigne). */
  summary?: ReactNode;
  /** Un seul bouton principal ; pleine largeur et 44 px dans la barre basse. */
  primaryAction?: ReactNode;
  className?: string;
}) {
  const hasActions = secondaryActions.length > 0 || Boolean(secondary) || Boolean(summary) || Boolean(primaryAction);

  return (
    <div
      data-slot="sticky-action-bar"
      className={cn(
        // Pas de backdrop-filter sous lg : il servirait de repère à la barre basse fixe.
        "sticky top-14 z-20 -mx-4 border-b bg-background px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:bg-background/80 lg:px-8 lg:backdrop-blur-md",
        className,
      )}
    >
      <div className="flex h-14 min-w-0 items-center gap-2 lg:gap-3">
        {back ? (
          <Link
            href={back.href}
            className="-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center gap-1 rounded-md text-meta text-muted-foreground transition-colors hover:text-foreground lg:ml-0 lg:size-auto lg:justify-start"
          >
            <ArrowLeft className="size-5 lg:hidden" aria-hidden />
            <span className="max-lg:sr-only">{back.label}</span>
            <ChevronRight className="size-3.5 max-lg:hidden" aria-hidden />
          </Link>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-sans text-base font-semibold tracking-tight text-foreground">{title}</h1>
          {meta ? <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}

        <div className="ml-auto flex items-center gap-2">
          {tools ? <div className="flex items-center gap-1 max-lg:hidden">{tools}</div> : null}
          {hasActions ? (
            <div
              data-slot="action-bar-actions"
              className="flex items-center gap-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:border-t max-lg:bg-background/95 max-lg:px-4 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-4px_12px_-6px_var(--shadow-2)] max-lg:backdrop-blur"
            >
              {secondaryActions.length > 0 ? (
                <>
                  <div className="flex items-center gap-0.5 max-lg:hidden">
                    {secondaryActions.map((a) => (
                      <RowActionButton key={a.label} action={a} />
                    ))}
                  </div>
                  <RowActionMenu actions={secondaryActions} className="size-11 shrink-0 lg:hidden" />
                </>
              ) : null}
              {summary ? (
                <div className="min-w-0 text-meta text-muted-foreground max-lg:flex-1 max-lg:truncate">{summary}</div>
              ) : null}
              {secondary ? <div className="flex shrink-0 items-center gap-2">{secondary}</div> : null}
              {primaryAction ? (
                <div
                  className={cn(
                    "flex items-center max-lg:[&>*]:h-11",
                    summary ? "shrink-0" : "max-lg:flex-1 max-lg:[&>*]:w-full",
                  )}
                >
                  {primaryAction}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * État discret de la barre (enregistrement, synchronisation) : icône + libellé ≥ lg,
 * icône seule (libellé lu par les lecteurs d'écran) en dessous. Fondu enchaîné au changement.
 */
export function ActionBarStatus({
  icon,
  label,
  tone = "muted",
  className,
  ...props
}: {
  icon: ReactNode;
  label: string;
  tone?: "muted" | "warning";
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "relative inline-flex items-center gap-1.5 text-xs [&_svg]:size-3.5 [&_svg]:shrink-0",
        tone === "warning" ? "text-warning-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={label} {...fadeMotion} className="inline-flex items-center gap-1.5">
          {icon}
          <span className="max-lg:sr-only">{label}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Barre flottante (SaveBar, sélection) : pastille centrée en bas ≥ sm, barre pleine
 * largeur sous sm (au-dessus de la barre d'onglets mobile via --bottom-nav-height).
 * Rendue dans un portail : insensible aux conteneurs transformés ou @container.
 */
export function FloatingBar({
  open,
  label,
  children,
  className,
}: {
  open: boolean;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="floating-bar"
          role="region"
          aria-label={label}
          data-slot="floating-bar"
          {...barMotion}
          className={cn(
            "fixed inset-x-0 bottom-(--bottom-nav-height) z-40 flex items-center gap-3 border-t bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm text-popover-foreground shadow-lg",
            "sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-max sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:rounded-xl sm:border sm:py-2.5 sm:pr-2.5",
            className,
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Barre de sélection (envoi groupé) : « 2 sélectionnés · Tout désélectionner · [action] ».
 * Visible dès qu'un élément est sélectionné ; l'action garde son data-testid (élément unique).
 */
export function SelectionBar({
  count,
  onClear,
  children,
  label,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <FloatingBar open={count > 0} label={label ?? fr.common.selectedCount(count)}>
      <span className="font-medium tabular-nums" aria-live="polite">
        {fr.common.selectedCount(count)}
      </span>
      <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
        {fr.common.clearSelection}
      </Button>
      <div className="ml-auto flex items-center gap-2 sm:ml-1">{children}</div>
    </FloatingBar>
  );
}
