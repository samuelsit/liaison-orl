import Link from "next/link";
import { Fragment, isValidElement, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export interface BreadcrumbEntry {
  label: ReactNode;
  /** Absent pour la page courante (dernier élément). */
  href?: string;
}

/** Ancien lien de retour : un nœud libre, ou un lien simple rendu comme fil d'Ariane. */
export type PageHeaderBack = ReactNode | { href: string; label: ReactNode };

function isBackLink(back: PageHeaderBack): back is { href: string; label: ReactNode } {
  return typeof back === "object" && back !== null && !isValidElement(back) && "href" in back;
}

/**
 * Fil d'Ariane discret (13 px, gris). Un seul parent se lit comme un lien
 * de retour (« ‹ Documents ») ; sinon les niveaux sont séparés par des chevrons.
 */
export function PageBreadcrumbs({ items, className }: { items: BreadcrumbEntry[]; className?: string }) {
  if (items.length === 0) return null;
  const single = items.length === 1 && items[0]!.href;
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="gap-1 text-meta">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={i}>
              <BreadcrumbItem className="min-w-0">
                {item.href ? (
                  <BreadcrumbLink asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-sm underline-offset-4 hover:text-foreground hover:underline pointer-coarse:min-h-11",
                        single && "-ml-1 pr-1",
                      )}
                    >
                      {single ? <ChevronLeft className="size-3.5" aria-hidden /> : null}
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!last ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Pastille d'identité (initiales ou icône) de l'en-tête d'une fiche : patient, ORL, envoi. */
export function PageHeaderTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * En-tête de page (cf. design §4.2) : fil d'Ariane, un seul titre h1 (police de titre),
 * méta (statut, version, compteur), description, actions (secondaires d'abord,
 * principale en dernier) et une zone d'outils (FilterBar, onglets « line »).
 *
 * Variante fiche : passer `leading` (PageHeaderTile) ; la description devient la ligne de méta.
 * `level={2}` sert aux sous-pages de l'administration, dont le h1 est dans le layout.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  meta,
  actions,
  children,
  back,
  leading,
  level = 1,
  titleId,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbEntry[];
  /** À droite du titre : StatusBadge, « v2 », compteur. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Zone d'outils sous le titre (FilterBar, Tabs variant="line"). */
  children?: ReactNode;
  /** @deprecated Utiliser `breadcrumbs`. Un objet `{ href, label }` est rendu comme fil d'Ariane. */
  back?: PageHeaderBack;
  /** Variante fiche : pastille de 40 px à gauche du titre. */
  leading?: ReactNode;
  level?: 1 | 2;
  titleId?: string;
  className?: string;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const crumbs = breadcrumbs ?? (back && isBackLink(back) ? [{ href: back.href, label: back.label }] : undefined);
  const legacyBack = back && !isBackLink(back) ? back : null;

  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4", level === 1 ? "mb-6 lg:mb-8" : "mb-6", className)}
    >
      {crumbs ? <PageBreadcrumbs items={crumbs} /> : legacyBack}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn("flex min-w-0 gap-4", leading ? "items-start" : "flex-col")}>
          {leading}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Heading
                id={titleId}
                className={cn(
                  "min-w-0 wrap-break-word text-foreground",
                  level === 1
                    ? "font-heading text-[1.375rem] leading-8 font-semibold sm:text-2xl"
                    : "text-lg font-semibold tracking-tight",
                )}
              >
                {title}
              </Heading>
              {meta}
            </div>
            {description ? (
              <div className={cn("max-w-2xl text-muted-foreground", leading ? "text-meta" : "text-sm")}>
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
