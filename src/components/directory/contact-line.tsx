import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

/** Liste de coordonnées (carte « Coordonnées » d'une fiche). */
export function ContactLines({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("-my-1 divide-y divide-border/60", className)}>{children}</ul>;
}

/**
 * Ligne de coordonnée : icône, valeur (lien mailto / tel, adresse sur plusieurs lignes),
 * bouton « Copier » facultatif. Hauteur minimale de 44 px.
 */
export function ContactLine({
  icon,
  children,
  copy,
  tone = "default",
}: {
  icon: ReactNode;
  children: ReactNode;
  copy?: { value: string; label: string; message: string };
  tone?: "default" | "warning";
}) {
  return (
    <li className="flex min-h-11 items-center gap-3 py-1">
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 self-start pt-3 [&_svg]:size-4",
          tone === "warning" ? "text-warning-foreground" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 py-2 text-sm wrap-break-word">{children}</div>
      {copy ? <CopyButton value={copy.value} label={copy.label} message={copy.message} /> : null}
    </li>
  );
}
