import Link from "next/link";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ListRowActions, type RowAction } from "./list-row-actions";
import { RelativeTime } from "./relative-time";

/*
 * Ligne de liste (documents, envois, patients, ORL, utilisateurs, centres ; cf. design §4.5).
 * Composant sans état : utilisable depuis un composant serveur comme client.
 *
 * Ordre DOM : le lien principal (étiré sur toute la ligne) vient EN PREMIER, avant
 * la pastille de tête et les actions, puis la grille replace visuellement chaque bloc.
 * Mobile : 2 lignes (titre + statut / sous-titre + date). ≥ sm : une ligne en colonnes.
 */

/** Liste sans habillage (dans une SectionCard `flush` ou un ListRowGroup). */
export function ListRows({ className, animated = false, ...props }: ComponentProps<"ul"> & { animated?: boolean }) {
  return (
    <ul
      data-slot="list-rows"
      className={cn("divide-y divide-border", animated && "rows-enter", className)}
      {...props}
    />
  );
}

/** Surface carte d'une liste autonome (page Documents, Envois…). `grouped` attend des ListRowGroup. */
export function ListRowContainer({
  className,
  grouped = false,
  animated = false,
  children,
  ...props
}: ComponentProps<"div"> & { grouped?: boolean; animated?: boolean }) {
  return (
    // overflow-clip (et non hidden) : les sous-titres de date restent collants.
    <div
      data-slot="list-row-container"
      className={cn("overflow-clip rounded-xl border bg-card shadow-xs", className)}
      {...props}
    >
      {grouped ? children : <ListRows animated={animated}>{children}</ListRows>}
    </div>
  );
}

/**
 * Groupe daté (« Aujourd'hui », « Cette semaine », « Plus ancien ») avec sous-titre collant.
 * Le décalage du collage suit `--list-sticky-top` (3.5rem par défaut, sous l'en-tête de l'application).
 */
export function ListRowGroup({
  label,
  children,
  animated = false,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  animated?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-slot="list-row-group" className={cn("border-t first:border-t-0", className)}>
      <h3
        id={id}
        className="sticky top-(--list-sticky-top,3.5rem) z-15 border-b bg-surface-subtle/95 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm"
      >
        {label}
      </h3>
      <ListRows animated={animated}>{children}</ListRows>
    </section>
  );
}

/** Pastille d'icône de tête (type de document, canal) ; `tone="danger"` pour une erreur. */
export function ListRowIcon({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "danger" | "brand";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md [&_svg:not([class*='size-'])]:size-4",
        tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : tone === "brand"
            ? "bg-accent text-accent-foreground"
            : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Avatar d'initiales de tête (patients, utilisateurs). */
export function ListRowAvatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Contrôle interactif de tête (case à cocher) : passe au-dessus du lien étiré, cible ≥ 44 px au toucher. */
export function ListRowControl({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center pointer-coarse:size-11", className)}
    >
      {children}
    </span>
  );
}

export interface ListRowProps extends Omit<ComponentProps<"li">, "title"> {
  /** Lien principal, étiré sur toute la ligne. */
  href?: string;
  title: ReactNode;
  /** Ligne secondaire (≥ sm), ex. « Adressage · Dr Marc DUBOIS · Claire MOREL ». */
  subtitle?: ReactNode;
  /** Remplace le sous-titre sous sm : l'information la plus utile seule (prescripteur, destinataire). */
  subtitleMobile?: ReactNode;
  /** Pastille de tête : ListRowIcon, ListRowAvatar ou ListRowControl (case à cocher). */
  leading?: ReactNode;
  /** StatusBadge. */
  badge?: ReactNode;
  /** Date de la ligne, en format court avec infobulle complète. */
  date?: Date | string | null;
  /** Contenu complémentaire à droite (≥ sm uniquement), avant le statut. */
  trailing?: ReactNode;
  /** Actions révélées au survol (pointeur fin) ou regroupées dans ⋯ (toucher). */
  actions?: RowAction[];
  /** Actions toujours visibles (étoile favori…), au-dessus du lien étiré. */
  pinnedActions?: ReactNode;
  selected?: boolean;
}

export function ListRow({
  href,
  title,
  subtitle,
  subtitleMobile,
  leading,
  badge,
  date,
  trailing,
  actions,
  pinnedActions,
  selected = false,
  className,
  ...props
}: ListRowProps) {
  const text = (
    <>
      <span className="block truncate text-sm font-medium text-foreground">{title}</span>
      {subtitle ? (
        <span
          className={cn(
            "block truncate text-meta text-muted-foreground",
            subtitleMobile !== undefined && "max-sm:hidden",
          )}
        >
          {subtitle}
        </span>
      ) : null}
      {subtitleMobile ? (
        <span className="block truncate text-meta text-muted-foreground sm:hidden">{subtitleMobile}</span>
      ) : null}
    </>
  );
  const mainClass = "col-start-2 row-span-2 row-start-1 min-w-0";

  return (
    <li
      data-slot="list-row"
      data-selected={selected || undefined}
      className={cn(
        "group/row relative grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center px-4 py-2.5 transition-colors duration-150 focus-within:bg-muted/60 hover:bg-muted/60 data-selected:bg-accent/60 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto]",
        className,
      )}
      {...props}
    >
      {href ? (
        <Link
          href={href}
          className={cn(
            mainClass,
            "outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid",
          )}
        >
          {text}
        </Link>
      ) : (
        <div className={mainClass}>{text}</div>
      )}

      {leading ? <div className="col-start-1 row-span-2 row-start-1 mr-3 flex">{leading}</div> : null}

      {trailing ? (
        <div className="col-start-3 row-span-2 row-start-1 ml-3 hidden items-center gap-2 sm:flex">{trailing}</div>
      ) : null}

      {badge ? (
        <div className="col-start-3 row-start-1 ml-3 flex justify-self-end sm:col-start-4 sm:row-span-2">{badge}</div>
      ) : null}

      {date ? (
        <RelativeTime
          date={date}
          className="col-start-3 row-start-2 ml-3 justify-self-end text-xs whitespace-nowrap text-muted-foreground sm:col-start-5 sm:row-span-2 sm:row-start-1 sm:w-24 sm:text-right"
        />
      ) : null}

      {pinnedActions || (actions && actions.length > 0) ? (
        <div className="relative z-10 col-start-4 row-span-2 row-start-1 -mr-1.5 ml-2 flex items-center gap-0.5 sm:col-start-6">
          {pinnedActions}
          {actions ? <ListRowActions actions={actions} /> : null}
        </div>
      ) : null}
    </li>
  );
}

export type { RowAction };
