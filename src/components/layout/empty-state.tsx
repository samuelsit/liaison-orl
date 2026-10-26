import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * État vide (cf. design §4.9), formulé positivement avec une action.
 * - `compact` : dans une carte (py-10), action en bouton outline `sm`.
 * - `page` : aucune donnée du tout, carte en pointillés et action principale.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "compact",
  tone = "neutral",
  className,
}: {
  /** Icône Lucide (élément), affichée en 20 px dans une pastille. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Bouton(s) : `size="sm" variant="outline"` en compact, bouton principal en page. */
  action?: ReactNode;
  variant?: "compact" | "page";
  tone?: "neutral" | "success";
  className?: string;
}) {
  return (
    <Empty
      data-variant={variant}
      className={cn(
        "gap-0 rounded-xl p-0 px-4",
        variant === "page" ? "border border-dashed bg-transparent py-14" : "border-0 py-10",
        className,
      )}
    >
      <EmptyHeader className="gap-1">
        {icon ? (
          <EmptyMedia
            className={cn(
              "mb-2 size-10 rounded-lg [&_svg:not([class*='size-'])]:size-5",
              tone === "success" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription className="mx-auto max-w-xs text-meta">{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent className="mt-4 flex-row flex-wrap justify-center gap-2">{action}</EmptyContent> : null}
    </Empty>
  );
}

/**
 * Aucun résultat pour une recherche : « Aucun résultat pour « dupont » » avec
 * [Effacer la recherche] et, sur les annuaires, [Créer « dupont »] (boutons fournis par l'appelant).
 */
export function NoResultsState({
  query,
  actions,
  className,
}: {
  query?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const q = query?.trim();
  return (
    <EmptyState
      icon={<SearchX aria-hidden />}
      title={q ? fr.common.noResultsFor(q) : fr.common.noResults}
      description={fr.common.noResultsHint}
      action={actions}
      className={className}
    />
  );
}
