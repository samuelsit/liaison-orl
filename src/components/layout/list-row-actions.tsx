"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shortcut, type ShortcutKey } from "@/components/ui/shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/** Action secondaire d'une ligne de liste (ou d'une barre d'outils) : lien ou bouton. */
export interface RowAction {
  label: string;
  /** Icône Lucide (élément), 16 px. */
  icon: ReactNode;
  href?: string;
  /** Lien vers une ressource à télécharger (route API) : `<a download>` sans navigation client. */
  download?: boolean;
  /** Ouvre la ressource (PDF, route API) dans un nouvel onglet : `<a target="_blank">`. */
  external?: boolean;
  /** Composants client uniquement (une fonction ne traverse pas la frontière serveur → client). */
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Porté par le bouton visible au pointeur fin ; jamais dupliqué dans le menu ⋯. */
  testId?: string;
  /** Raccourci affiché dans l'infobulle (le raccourci lui-même est géré par l'écran). */
  shortcut?: readonly ShortcutKey[];
}

/**
 * Élément lien d'une action (`<Link>`, ou `<a>` natif pour une route API), à placer
 * comme enfant direct d'un composant `asChild` ; `null` pour une action bouton.
 */
function actionLink(action: RowAction, children: ReactNode) {
  if (!action.href) return null;
  if (action.download || action.external) {
    return (
      <a
        href={action.href}
        download={action.download || undefined}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }
  return <Link href={action.href}>{children}</Link>;
}

/** Bouton icône fantôme avec infobulle (pointeur fin). */
export function RowActionButton({ action, className }: { action: RowAction; className?: string }) {
  const link = actionLink(action, action.icon);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={action.label}
          disabled={action.disabled}
          data-testid={action.testId}
          asChild={Boolean(link)}
          type={link ? undefined : "button"}
          onClick={link ? undefined : action.onSelect}
          className={cn(
            action.destructive
              ? "text-destructive hover:text-destructive"
              : "text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          {link ?? action.icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {action.label}
        {action.shortcut ? <Shortcut keys={action.shortcut} /> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Éléments d'un menu ⋯ ; les actions destructives sont regroupées en bas. */
export function RowActionMenuItems({ actions }: { actions: RowAction[] }) {
  const regular = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);
  const item = (a: RowAction) =>
    a.href ? (
      <DropdownMenuItem key={a.label} asChild disabled={a.disabled} variant={a.destructive ? "destructive" : "default"}>
        {actionLink(
          a,
          <>
            {a.icon}
            {a.label}
          </>,
        )}
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem
        key={a.label}
        onSelect={a.onSelect}
        disabled={a.disabled}
        variant={a.destructive ? "destructive" : "default"}
      >
        {a.icon}
        {a.label}
      </DropdownMenuItem>
    );
  return (
    <>
      {regular.map(item)}
      {regular.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
      {destructive.map(item)}
    </>
  );
}

/** Bouton ⋯ ouvrant le menu des actions. */
export function RowActionMenu({
  actions,
  label = fr.common.moreActions,
  className,
}: {
  actions: RowAction[];
  label?: string;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn("text-muted-foreground hover:text-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-52">
        <RowActionMenuItems actions={actions} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Actions d'une ligne de liste : boutons icônes révélés au survol / focus au pointeur
 * fin, un seul menu ⋯ toujours visible au toucher (le menu n'est monté qu'à l'ouverture).
 */
export function ListRowActions({ actions }: { actions: RowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <>
      <div className="flex items-center gap-0.5 transition-opacity duration-150 pointer-coarse:hidden pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100">
        {actions.map((a) => (
          <RowActionButton key={a.label} action={a} />
        ))}
      </div>
      <RowActionMenu actions={actions} className="hidden pointer-coarse:inline-flex" />
    </>
  );
}
