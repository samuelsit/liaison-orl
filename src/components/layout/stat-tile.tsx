import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatDelta {
  /** Texte signé déjà formaté : « +12 % », « −3 ». */
  value: string;
  direction: "up" | "down" | "flat";
  /** Période de comparaison nommée : « vs 30 j précédents ». */
  period: string;
  /** Faux quand une hausse est une mauvaise nouvelle (erreurs, coûts). */
  upIsGood?: boolean;
}

/**
 * Grille d'indicateurs (cf. design §4.7) : 2 colonnes sur mobile, 3 puis 6.
 * Liste de définitions : chaque StatTile fournit un couple dt / dd.
 */
export function StatTiles({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", className)}>{children}</dl>;
}

/**
 * Indicateur : libellé (phrase, sans deux-points), une seule mesure par valeur,
 * écart facultatif contre une période nommée. Avec `href`, toute la tuile mène au détail.
 */
export function StatTile({
  label,
  value,
  detail,
  delta,
  icon,
  href,
  className,
}: {
  label: ReactNode;
  /** Valeur déjà formatée (« 1 284 », « 42,50 € ») : une seule mesure, jamais « 6 / 3 ». */
  value: ReactNode;
  /** Précision sous la valeur (13 px, gris). */
  detail?: ReactNode;
  delta?: StatDelta;
  /** Icône Lucide (élément) en haut à droite, 16 px grise. */
  icon?: ReactNode;
  href?: string;
  className?: string;
}) {
  const good = delta && delta.direction !== "flat" ? (delta.direction === "up") === (delta.upIsGood ?? true) : null;
  const DeltaIcon =
    delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : ArrowRight;

  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs",
        href &&
          "transition-[border-color,box-shadow] duration-150 focus-within:border-ring hover:border-foreground/20 hover:shadow-sm",
        className,
      )}
    >
      <dt className="flex items-start justify-between gap-2 text-meta text-muted-foreground">
        {href ? (
          <Link
            href={href}
            className="min-w-0 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid"
          >
            {label}
          </Link>
        ) : (
          <span className="min-w-0">{label}</span>
        )}
        {icon ? (
          <span aria-hidden className="shrink-0 text-muted-foreground [&_svg:not([class*='size-'])]:size-4">
            {icon}
          </span>
        ) : null}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight whitespace-nowrap text-foreground">{value}</dd>
      {detail ? <dd className="text-meta text-muted-foreground">{detail}</dd> : null}
      {delta ? (
        <dd
          className={cn(
            "mt-1 inline-flex flex-wrap items-center gap-x-1 text-xs",
            good === null ? "text-muted-foreground" : good ? "text-success-foreground" : "text-destructive",
          )}
        >
          <DeltaIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="font-medium">{delta.value}</span>
          <span className="text-muted-foreground">{delta.period}</span>
        </dd>
      ) : null}
    </div>
  );
}
