import Link from "next/link";
import { useId, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * Carte de section (accueil, fiches) : titre h2 en police d'interface, compteur discret,
 * lien « Tout voir → » ou action à droite, pied facultatif pour les actions locales.
 * `flush` retire les marges du contenu pour les listes (ListRows) qui portent leurs propres marges.
 */
export function SectionCard({
  title,
  icon,
  description,
  href,
  hrefLabel = fr.common.seeAll,
  action,
  count,
  children,
  footer,
  tone = "default",
  flush = false,
  headingLevel = 2,
  className,
  contentClassName,
}: {
  title: string;
  /** Icône 16 px (grise, rouge en ton « danger »). */
  icon?: ReactNode;
  description?: ReactNode;
  /** Lien « Tout voir » ; son nom accessible reprend le titre de la carte. */
  href?: string;
  hrefLabel?: string;
  /** Action à droite de l'en-tête (bouton ghost `sm`), à la place du lien. */
  action?: ReactNode;
  /** Compteur affiché après le titre (masqué à 0). */
  count?: number;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "danger";
  flush?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
  contentClassName?: string;
}) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const right = action ?? (href ? <SeeAllLink href={href} label={hrefLabel} context={title} /> : null);

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      data-tone={tone}
      className={cn(tone === "danger" && "border-destructive/30", className)}
    >
      <CardHeader>
        <Heading
          id={titleId}
          data-slot="card-title"
          className={cn(
            "flex min-w-0 items-center gap-2 self-center text-sm leading-5 font-semibold [&_svg]:size-4 [&_svg]:shrink-0",
            tone === "danger" ? "[&_svg]:text-destructive" : "[&_svg]:text-muted-foreground",
          )}
        >
          {icon}
          <span className="truncate">{title}</span>
          {typeof count === "number" && count > 0 ? (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
          ) : null}
        </Heading>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {/* Sans description, l'action reste sur la ligne du titre (le lien fait 44 px au toucher). */}
        {right ? <CardAction className={description ? undefined : "row-span-1"}>{right}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn(flush && "border-t px-0 pb-0 group-data-[size=sm]/card:pb-0", contentClassName)}>
        {children}
      </CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}

/** Lien « Tout voir → » (13 px, couleur de marque) ; `context` complète le nom pour les lecteurs d'écran. */
export function SeeAllLink({
  href,
  label = fr.common.seeAll,
  context,
  className,
}: {
  href: string;
  label?: string;
  context?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/see-all inline-flex items-center gap-1 rounded-sm text-meta font-medium text-brand-fg underline-offset-4 hover:underline pointer-coarse:min-h-11",
        className,
      )}
    >
      {label}
      {context ? <span className="sr-only"> : {context}</span> : null}
      <ArrowRight
        className="size-3.5 transition-transform duration-150 group-hover/see-all:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
