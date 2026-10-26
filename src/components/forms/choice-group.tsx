"use client";

import { useRef, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Choice<V extends string | boolean> {
  value: V;
  label: string;
  hint?: string;
}

/** Nombre de colonnes, éventuellement différent à partir de sm (640 px). */
export type ChoiceColumns = number | { base: number; sm?: number };

/*
 * Tuiles de choix (cf. design §5) : 44 px minimum même au pointeur fin (saisie rapide),
 * sélection teintée (bg-accent + contour de marque + coche), jamais un aplat plein.
 */
const tileClassName =
  "flex min-h-11 min-w-0 items-center justify-center gap-x-1.5 rounded-lg border bg-card px-3 py-1.5 text-center text-sm font-medium text-foreground transition-[color,background-color,border-color,box-shadow] duration-150 " +
  "hover:border-foreground/20 hover:bg-muted/50 " +
  "aria-checked:border-ring aria-checked:bg-accent aria-checked:text-accent-foreground aria-checked:ring-1 aria-checked:ring-ring aria-checked:hover:bg-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card";

const readOnlyTileClassName = "cursor-default bg-surface-subtle hover:border-border hover:bg-surface-subtle";

function columnsStyle(columns: ChoiceColumns): CSSProperties {
  const base = typeof columns === "number" ? columns : columns.base;
  const sm = typeof columns === "number" ? columns : (columns.sm ?? columns.base);
  return {
    "--choice-cols": `repeat(${base}, minmax(0, 1fr))`,
    "--choice-cols-sm": `repeat(${sm}, minmax(0, 1fr))`,
  } as CSSProperties;
}

/**
 * Choix exclusif sous forme de tuiles (role radiogroup / radio). Un second clic sur
 * l'option active la désélectionne : aucune valeur n'est imposée.
 *
 * Clavier (motif WAI-ARIA « radio group ») : une seule tabulation pour le groupe ;
 * flèches = option suivante / précédente (le focus suit la sélection), Début / Fin,
 * Espace ou Entrée sélectionne ou désélectionne l'option focalisée.
 */
export function ChoiceGroup<V extends string | boolean>({
  id,
  label: _label,
  value,
  onChange,
  options,
  invalid,
  readOnly = false,
  disabled = false,
  className,
  columns,
}: {
  id: string;
  /** Libellé (affiché par le champ parent avec l'identifiant `${id}-label`). */
  label: string;
  value: V | null;
  onChange: (v: V | null) => void;
  options: Choice<V>[];
  invalid?: boolean;
  /** Document validé : la valeur reste lisible et focalisable mais ne change plus. */
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  columns?: ChoiceColumns;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const locked = readOnly || disabled;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const from = refs.current.findIndex((el) => el === e.target);
    if (from < 0) return;
    const last = options.length - 1;
    let to: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = from === last ? 0 : from + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = from === 0 ? last : from - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = last;
    if (to === null) return;
    e.preventDefault();
    refs.current[to]?.focus();
    if (!locked) onChange(options[to]!.value);
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-invalid={invalid || undefined}
      aria-readonly={readOnly || undefined}
      aria-disabled={disabled || undefined}
      data-slot="choice-group"
      className={cn("grid grid-cols-(--choice-cols) gap-2 sm:grid-cols-(--choice-cols-sm)", className)}
      style={columnsStyle(columns ?? options.length)}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => {
        const active = i === selectedIndex;
        const tabbable = selectedIndex >= 0 ? active : i === 0;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (!locked) onChange(active ? null : o.value);
            }}
            className={cn(
              tileClassName,
              o.hint && "flex-col gap-y-0",
              readOnly && readOnlyTileClassName,
              invalid && !active && "border-destructive/60",
            )}
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {active ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
              <span className="min-w-0">{o.label}</span>
            </span>
            {/* Espace pour le nom accessible (« Profonde ≥ 90 dB ») ; invisible entre éléments flex. */}
            {o.hint ? " " : null}
            {o.hint ? <span className="text-xs font-normal text-muted-foreground">{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Case à cocher en tuile (« Examens demandés ») : même langage visuel que ChoiceGroup.
 * Accepte les attributs d'un bouton (data-testid…). `role="checkbox"` + `aria-checked`.
 */
export function CheckboxTile({
  checked,
  onCheckedChange,
  children,
  description,
  readOnly = false,
  invalid = false,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "onChange" | "role" | "type" | "children"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  description?: ReactNode;
  readOnly?: boolean;
  invalid?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-readonly={readOnly || undefined}
      disabled={disabled}
      onClick={() => {
        if (!readOnly) onCheckedChange(!checked);
      }}
      className={cn(
        tileClassName,
        "group/tile min-h-12 w-full justify-start gap-x-3 px-4 text-left",
        readOnly && readOnlyTileClassName,
        invalid && !checked && "border-destructive/60",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-muted-foreground/80 bg-card text-primary-foreground transition-colors group-aria-checked/tile:border-primary group-aria-checked/tile:bg-primary"
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block">{children}</span>
        {description ? <span className="block text-meta font-normal text-muted-foreground">{description}</span> : null}
      </span>
    </button>
  );
}
