"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { ChoiceGroup, type Choice, type ChoiceColumns } from "@/components/forms/choice-group";
import { cn } from "@/lib/utils";

/**
 * Ctrl/⌘ + Entrée envoie le formulaire, même depuis une zone de texte. L'événement ne
 * remonte pas : l'écran parent (éditeur, ⌘↵ = valider) n'est pas déclenché.
 */
export function submitOnModEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.altKey) return;
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.requestSubmit();
}

/** Bloc titré d'un formulaire de fiche (Identité, Coordonnées…), sans encadré. */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("space-y-5 border-t pt-5 first:border-t-0 first:pt-0", className)}>
      <h3 id={id} className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Choix exclusif en tuiles (civilité, canal) avec son libellé : même rendu que l'éditeur.
 * Une valeur reste toujours sélectionnée (re-cliquer l'option active ne la vide pas).
 */
export function ChoiceField<V extends string>({
  id,
  label,
  value,
  onChange,
  options,
  columns,
  className,
}: {
  id: string;
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: Choice<V>[];
  columns?: ChoiceColumns;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <span id={`${id}-label`} className="flex min-h-5 items-center text-sm leading-5 font-medium">
        {label}
      </span>
      <ChoiceGroup id={id} label={label} value={value} onChange={(v) => v !== null && onChange(v)} options={options} columns={columns} />
    </div>
  );
}
