import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";
import { PageContainer, type PageContainerSize } from "./page-container";

/*
 * Squelettes de chargement à la forme des vrais écrans (fichiers loading.tsx) :
 * pas de saut de mise en page à l'arrivée du contenu. Les blocs sont vides (ignorés
 * par les lecteurs d'écran) ; SkeletonPage annonce « Chargement… » une seule fois.
 */

/** Conteneur de page en chargement (aria-busy + texte pour lecteurs d'écran). */
export function SkeletonPage({
  size,
  children,
  className,
}: {
  size?: PageContainerSize;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PageContainer size={size} className={className} aria-busy="true">
      <span role="status" className="sr-only">
        {fr.common.loading}
      </span>
      {children}
    </PageContainer>
  );
}

/** En-tête de page : fil d'Ariane, titre, description, actions. */
export function PageHeaderSkeleton({
  breadcrumb = false,
  actions = 0,
  description = true,
  entity = false,
}: {
  breadcrumb?: boolean;
  actions?: number;
  description?: boolean;
  entity?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:mb-8">
      {breadcrumb ? <Skeleton className="h-4 w-28" /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {entity ? <Skeleton className="size-10 shrink-0 rounded-lg" /> : null}
          <div className="space-y-2.5 pt-1">
            <Skeleton className="h-7 w-56 max-w-[60vw]" />
            {description ? <Skeleton className="h-4 w-80 max-w-[75vw]" /> : null}
          </div>
        </div>
        {actions > 0 ? (
          <div className="flex gap-2">
            {Array.from({ length: actions }, (_, i) => (
              <Skeleton key={i} className="h-9 w-32 rounded-lg" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Barre de filtres : recherche + contrôle segmenté + bouton « Filtres ». */
export function FilterBarSkeleton({ segments = 4 }: { segments?: number }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Skeleton className="h-9 w-full rounded-lg sm:max-w-sm" />
      <Skeleton className="h-9 rounded-lg" style={{ width: `${segments * 5.5}rem`, maxWidth: "100%" }} />
      <Skeleton className="h-9 w-24 rounded-lg max-sm:hidden" />
    </div>
  );
}

/** Lignes de liste (géométrie de ListRow : pastille 32 px, deux lignes de texte, statut, date). */
export function ListSkeleton({
  rows = 6,
  leading = "icon",
  container = true,
  className,
}: {
  rows?: number;
  leading?: "icon" | "avatar" | "none";
  container?: boolean;
  className?: string;
}) {
  const list = (
    <ul className={cn("divide-y", !container && className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          {leading !== "none" ? (
            <Skeleton className={cn("size-8 shrink-0", leading === "avatar" ? "rounded-full" : "rounded-md")} />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4" style={{ width: `${45 + ((i * 17) % 30)}%` }} />
            <Skeleton className="h-3" style={{ width: `${30 + ((i * 23) % 25)}%` }} />
          </div>
          <Skeleton className="h-[22px] w-20 rounded-full max-sm:hidden" />
          <Skeleton className="h-3 w-16 max-sm:hidden" />
        </li>
      ))}
    </ul>
  );
  if (!container) return list;
  return <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>{list}</div>;
}

/** Carte : en-tête (titre) puis lignes de texte ou liste. */
export function CardSkeleton({ lines = 3, rows, className }: { lines?: number; rows?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-14" />
      </div>
      {rows ? (
        <div className="border-t">
          <ListSkeleton rows={rows} container={false} />
        </div>
      ) : (
        <div className="space-y-2.5 px-5 pb-5">
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className="h-4" style={{ width: `${90 - ((i * 13) % 35)}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Rangée d'indicateurs (StatTiles). */
export function StatTilesSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Écran outil (éditeur, récapitulatif d'envoi) : barre collante, formulaire, aperçu A4. */
export function EditorSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <>
      <div className="-mx-4 flex h-14 items-center gap-3 border-b px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Skeleton className="h-4 w-20 max-lg:hidden" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-[22px] w-20 rounded-full" />
        <Skeleton className="ml-auto h-9 w-44 rounded-lg max-lg:hidden" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(400px,44%)] xl:gap-8">
        <div className="w-full max-w-[760px] space-y-5">
          {Array.from({ length: sections }, (_, i) => (
            <div key={i} className="space-y-5 rounded-xl border bg-card px-5 pt-4 pb-5 shadow-xs">
              <div className="flex items-center gap-3">
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="h-5 w-40" />
              </div>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, j) => (
                  <div key={j} className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="max-lg:hidden">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="rounded-xl bg-muted/60 p-4 ring-1 ring-border dark:bg-black/30">
            <Skeleton className="mx-auto aspect-[1/1.414] w-full max-w-[560px] rounded-sm bg-card" />
          </div>
        </div>
      </div>
    </>
  );
}
