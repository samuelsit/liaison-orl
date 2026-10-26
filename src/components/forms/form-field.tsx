import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * Champ de formulaire : libellé (6 px au-dessus du contrôle), puis aide ou erreur
 * sous le contrôle (13 px). L'astérisque des champs obligatoires est discret ;
 * le contrôle porte `aria-required` (cf. `fieldAria`) et le formulaire une RequiredLegend.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
  aside,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id} className={cn("leading-5", error && "text-destructive")}>
          {label}
          {required ? (
            <span className="-ml-1.5 text-muted-foreground" aria-hidden>
              {" "}
              *
            </span>
          ) : null}
        </Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-meta text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-meta text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Attributs ARIA d'un champ : erreur (aria-invalid + aria-describedby) et caractère obligatoire. */
export function fieldAria(
  id: string,
  error?: string,
  { required = false, hint = false }: { required?: boolean; hint?: boolean } = {},
) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    "aria-required": required || undefined,
  };
}

/** Légende unique d'un formulaire comportant des champs obligatoires. */
export function RequiredLegend({ className }: { className?: string }) {
  return <p className={cn("text-meta text-muted-foreground", className)}>{fr.common.requiredLegend}</p>;
}
