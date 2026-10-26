import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Écran d'état pleine page (404, erreur) : même grammaire que les états vides
 * (pastille d'icône, titre, explication, actions), en plus grand.
 */
export function StatusScreen({
  icon,
  tone = "neutral",
  eyebrow,
  title,
  description,
  actions,
  children,
  role,
  className,
}: {
  icon: ReactNode;
  tone?: "neutral" | "danger";
  /** Petite ligne au-dessus du titre (« Erreur 404 »). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  role?: "alert";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn("mx-auto flex min-h-[55dvh] w-full max-w-lg flex-col items-center justify-center px-2 py-10 text-center", className)}
    >
      <span
        aria-hidden
        className={cn(
          "mb-5 flex size-14 items-center justify-center rounded-2xl [&_svg]:size-7",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground",
        )}
      >
        {icon}
      </span>
      {eyebrow ? <p className="mb-1 text-meta font-medium text-muted-foreground">{eyebrow}</p> : null}
      <h1 className="font-heading text-2xl font-semibold text-foreground">{title}</h1>
      {description ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
      {children}
    </div>
  );
}
