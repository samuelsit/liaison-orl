import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

export type EditorSectionStatus = "incomplete" | "complete" | "error";

/**
 * Section du formulaire (cf. design §4.4) : carte calme avec numéro d'étape (coche
 * une fois complète), titre h2 en police d'interface, actions à droite, description.
 *
 * Les attributs data-editor-section / data-section-id / data-section-title /
 * data-section-status permettent à un navigateur de sections de découvrir les
 * sections dans le DOM (ordre, titre, état) sans couplage.
 */
export function EditorSection({
  title,
  children,
  aside,
  className,
  id,
  step,
  status = "incomplete",
  description,
}: {
  title: string;
  children: ReactNode;
  /** Boutons fantômes `sm` à droite du titre (Dicter, Voir le bilan…). */
  aside?: ReactNode;
  className?: string;
  /** Identifiant de la section (ancre) ; le titre porte `${id}-title`. */
  id?: string;
  /** Numéro d'étape affiché dans la pastille. */
  step?: number;
  status?: EditorSectionStatus;
  description?: ReactNode;
}) {
  const autoId = useId();
  const sectionId = id ?? autoId;
  const titleId = `${sectionId}-title`;
  const complete = status === "complete";

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-editor-section=""
      data-section-id={sectionId}
      data-section-title={title}
      data-section-status={status}
      className={cn("scroll-mt-32 rounded-xl border bg-card shadow-xs", className)}
    >
      <header className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        {step != null ? (
          <span
            aria-hidden
            data-status={status}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors duration-150",
              complete
                ? "bg-success text-success-foreground"
                : status === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-accent text-accent-foreground",
            )}
          >
            {complete ? <Check className="size-3.5" aria-hidden /> : step}
          </span>
        ) : null}
        <h2 id={titleId} className="min-w-0 text-base font-semibold tracking-tight text-foreground">
          {title}
          {complete ? <span className="sr-only"> ({fr.common.sectionComplete})</span> : null}
        </h2>
        {aside ? <div className="ml-auto flex items-center gap-1">{aside}</div> : null}
      </header>
      {description ? <div className="px-4 pt-1 text-meta text-muted-foreground sm:px-5">{description}</div> : null}
      <div className="space-y-5 px-4 pt-4 pb-5 sm:px-5">{children}</div>
    </section>
  );
}

/**
 * Libellé d'un champ de l'éditeur. L'astérisque des champs obligatoires est discret
 * (le formulaire porte une légende « * champ obligatoire »).
 */
export function FieldLabelRow({
  htmlFor,
  label,
  badge,
  required,
  error,
  group,
}: {
  htmlFor: string;
  label: string;
  badge?: ReactNode;
  required?: boolean;
  error?: string;
  /** Libellé d'un groupe de choix (référencé par aria-labelledby). */
  group?: boolean;
}) {
  const content = (
    <>
      {label}
      {required ? (
        <span className="text-muted-foreground" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
    </>
  );
  return (
    <div className="mb-1.5 flex min-h-5 flex-wrap items-center gap-2">
      {group ? (
        <span id={`${htmlFor}-label`} className={cn("text-sm font-medium", error && "text-destructive")}>
          {content}
        </span>
      ) : (
        <label
          htmlFor={htmlFor}
          id={`${htmlFor}-label`}
          className={cn("text-sm font-medium", error && "text-destructive")}
        >
          {content}
        </label>
      )}
      {badge}
      {error ? (
        <span role="alert" className="text-meta text-destructive">
          — {error}
        </span>
      ) : null}
    </div>
  );
}
