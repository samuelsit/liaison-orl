"use client";

import Link from "next/link";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Check, ListFilter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/*
 * Barre de filtres des listes (cf. design §4.8).
 * ≥ sm, une ligne : [Recherche] [Statut segmenté] [Filtres ▾] [puces] … [N résultats] [actions].
 * Mobile : [Recherche | Filtres] puis le contrôle segmenté défilant sur une ligne ;
 * les filtres secondaires s'ouvrent dans un panneau bas.
 */

export function FilterBar({
  search,
  status,
  filters,
  activeFilterCount = 0,
  onResetFilters,
  resultCount,
  actions,
  children,
  sticky = false,
  className,
}: {
  /** Généralement <FilterSearch />. */
  search?: ReactNode;
  /** Généralement <SegmentedControl size="sm"> avec compteurs. */
  status?: ReactNode;
  /** Contenu du menu « Filtres » (popover ≥ md, panneau bas en dessous). */
  filters?: ReactNode;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  /** Nombre (→ « 12 résultats ») ou texte libre ; annoncé aux lecteurs d'écran. */
  resultCount?: number | ReactNode;
  /** À droite (bouton « Nouveau… »). */
  actions?: ReactNode;
  /** Puces de filtre en ligne (FilterChip), après le menu « Filtres ». */
  children?: ReactNode;
  /** Colle la barre sous l'en-tête de l'application (listes plus longues que l'écran). */
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="filter-bar"
      data-sticky={sticky || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
        sticky &&
          "sticky top-14 z-20 -mx-4 bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 sm:contents">
        {search ? <div className="min-w-0 flex-1 sm:order-1 sm:max-w-sm sm:min-w-56">{search}</div> : null}
        {filters ? (
          <FilterMenu activeCount={activeFilterCount} onReset={onResetFilters} className="sm:order-3">
            {filters}
          </FilterMenu>
        ) : null}
      </div>
      {status ? (
        // Mobile : une seule ligne qui défile jusqu'aux bords de l'écran, sans retour à la ligne.
        <div className="scroll-thin -mx-4 overflow-x-auto overscroll-x-contain px-4 sm:order-2 sm:mx-0 sm:overflow-visible sm:px-0">
          {status}
        </div>
      ) : null}
      {children ? <div className="flex flex-wrap items-center gap-2 sm:order-4">{children}</div> : null}
      {resultCount !== undefined || actions ? (
        <div className="flex items-center gap-3 sm:order-5 sm:ml-auto">
          {resultCount !== undefined ? (
            <p
              role="status"
              aria-live="polite"
              className="text-meta whitespace-nowrap text-muted-foreground tabular-nums max-sm:sr-only"
            >
              {typeof resultCount === "number" ? fr.common.resultCount(resultCount) : resultCount}
            </p>
          ) : null}
          {actions ? <div className="flex flex-1 items-center justify-end gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Champ de recherche avec loupe, bouton d'effacement et indicateur de chargement. Échap efface. */
export function FilterSearch({
  value,
  onValueChange,
  pending = false,
  placeholder = fr.common.search,
  className,
  onKeyDown,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
  pending?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={props["aria-label"] ?? placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            e.stopPropagation();
            onValueChange("");
          }
          onKeyDown?.(e);
        }}
        className={cn(
          "pl-9 [&::-webkit-search-cancel-button]:appearance-none",
          value && pending ? "pr-16" : value || pending ? "pr-9" : undefined,
        )}
        {...props}
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-1">
        {pending ? <Spinner className="text-muted-foreground" /> : null}
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={fr.common.clearSearch}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              onValueChange("");
              ref.current?.focus();
            }}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Bouton « Filtres » avec compteur ; popover sur grand écran, panneau bas sur mobile. */
export function FilterMenu({
  activeCount = 0,
  onReset,
  title = fr.common.filtersTitle,
  label = fr.common.filters,
  children,
  className,
}: {
  activeCount?: number;
  onReset?: () => void;
  title?: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = (
    <Button variant="outline" className={cn("shrink-0", className)}>
      <ListFilter aria-hidden />
      <span className="max-sm:sr-only">{label}</span>
      {activeCount > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-semibold text-accent-foreground tabular-nums ring-1 ring-ring/20 ring-inset">
          {activeCount}
          <span className="sr-only"> ({fr.common.activeFilters(activeCount)})</span>
        </span>
      ) : null}
    </Button>
  );
  const reset =
    onReset && activeCount > 0 ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onReset();
          setOpen(false);
        }}
      >
        {fr.common.resetFilters}
      </Button>
    ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="gap-0">
          <SheetHeader className="px-4 pt-5 pb-3">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">{fr.common.activeFilters(activeCount)}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">{children}</div>
          <SheetFooter className="flex-row border-t bg-surface-subtle px-4 py-3">
            {reset}
            <Button className="ml-auto" size="lg" onClick={() => setOpen(false)}>
              {fr.common.showResults}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <p className="text-sm font-semibold">{title}</p>
          {reset}
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/** Groupe de filtres libellé dans le menu « Filtres ». */
export function FilterGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)}>
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

type FilterChipProps = {
  active: boolean;
  children: ReactNode;
  /** Icône Lucide (élément) affichée quand la puce est inactive. */
  icon?: ReactNode;
  count?: number;
  className?: string;
} & ({ href: string; onActiveChange?: never } | { href?: never; onActiveChange: (active: boolean) => void });

/**
 * Puce de filtre secondaire : contour neutre, active = teinte de marque + coche (jamais pleine).
 * Lien (filtres portés par l'URL, `aria-current`) ou bouton bascule (`aria-pressed`).
 */
export function FilterChip({ active, children, icon, count, className, ...rest }: FilterChipProps) {
  const classes = cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-meta font-medium whitespace-nowrap transition-colors duration-150 pointer-coarse:h-11 [&_svg]:size-3.5 [&_svg]:shrink-0",
    active
      ? "border-ring/40 bg-accent text-accent-foreground"
      : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    className,
  );
  const content = (
    <>
      {active ? <Check aria-hidden /> : icon}
      {children}
      {typeof count === "number" ? <span className="text-2xs text-muted-foreground tabular-nums">{count}</span> : null}
    </>
  );
  if ("href" in rest && rest.href) {
    return (
      <Link href={rest.href} scroll={false} aria-current={active ? "true" : undefined} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={active} onClick={() => rest.onActiveChange?.(!active)} className={classes}>
      {content}
    </button>
  );
}
