import { useId, type ReactNode } from "react";
import { Card, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/*
 * Pages de réglages (administration, /compte ; cf. design §4.12).
 * SettingsSections fournit le conteneur @container ; chaque SettingsSection présente
 * à gauche le titre et l'explication, à droite une carte de champs (empilés en dessous de @3xl).
 */

export function SettingsSections({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("@container", className)}>{children}</div>;
}

export function SettingsSection({
  title,
  description,
  children,
  footer,
  id,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Actions locales à la carte (jamais un bouton pleine largeur) ; sinon SaveBar. */
  footer?: ReactNode;
  /** Ancre (#id) de la section. */
  id?: string;
  className?: string;
  contentClassName?: string;
}) {
  const titleId = useId();
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "grid scroll-mt-20 gap-4 border-t py-8 first:border-t-0 first:pt-0 @3xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @3xl:gap-10",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {description ? <div className="text-meta text-muted-foreground">{description}</div> : null}
      </div>
      <Card className="min-w-0">
        <div className={cn("space-y-5 p-(--card-px)", contentClassName)}>{children}</div>
        {footer ? <CardFooter>{footer}</CardFooter> : null}
      </Card>
    </section>
  );
}

/** Groupe de SwitchRow séparés par des filets (à utiliser dans une SettingsSection). */
export function SwitchRows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y", className)}>{children}</div>;
}

/**
 * Ligne de réglage façon iOS : libellé et explication à gauche, interrupteur à droite.
 * Toute la zone du libellé active l'interrupteur ; ≥ 44 px de haut au toucher.
 */
export function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  badge,
  className,
}: {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Pastille après le libellé (« Démo », « Recommandé »). */
  badge?: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const descriptionId = `${switchId}-description`;
  return (
    <div className={cn("flex min-h-11 items-start justify-between gap-6 py-4 first:pt-0 last:pb-0", className)}>
      <div className="min-w-0 space-y-0.5">
        <label
          htmlFor={switchId}
          className={cn(
            "flex flex-wrap items-center gap-2 text-sm font-medium",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          )}
        >
          {label}
          {badge}
        </label>
        {description ? (
          <p id={descriptionId} className="text-meta text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        className="mt-0.5"
      />
    </div>
  );
}
