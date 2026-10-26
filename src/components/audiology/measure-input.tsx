"use client";

import { useState, type ClipboardEvent, type ComponentProps, type KeyboardEvent } from "react";
import type { Measure } from "@/lib/schemas/audiometry";
import { fieldControlClassName } from "@/components/ui/input";
import { fr } from "@/lib/i18n/fr";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import { cellText, parseCell, parsePastedValues, toMeasure, type ParsedCell } from "./measure-cells";

export type MeasureInputVariant = "cell" | "boxed" | "mobile";

const VARIANT_CLASS: Record<MeasureInputVariant, string> = {
  // Case de tableur : quadrillage porté par la cellule, fond transparent, anneau de focus intérieur.
  cell:
    "h-10 w-full min-w-0 rounded-none border-0 bg-transparent px-1 text-center text-sm tabular-nums outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted focus:bg-card focus:ring-2 focus:ring-ring focus:ring-inset dark:focus:bg-popover",
  boxed: cn(fieldControlClassName, "h-9 px-2 text-center tabular-nums pointer-coarse:h-11"),
  mobile: cn(fieldControlClassName, "h-11 px-2 text-center text-base tabular-nums"),
};

/**
 * Saisie d'une mesure audiométrique (dB ou %) : « N » = pas de réponse, sélection
 * complète au focus, valeur invalide signalée. La confiance de lecture de l'IA est
 * visible (faible : fond orangé + coin ; moyenne : point) et annoncée (aria-describedby).
 */
export function MeasureInput({
  m,
  onChange,
  label,
  max = 140,
  variant = "boxed",
  lowConfidenceId,
  mediumConfidenceId,
  onMarkChecked,
  onPasteValues,
  className,
  inputMode = "decimal",
  ...props
}: Omit<ComponentProps<"input">, "onChange" | "value" | "defaultValue"> & {
  m: Measure | null | undefined;
  onChange: (m: Measure | null) => void;
  label: string;
  max?: number;
  variant?: MeasureInputVariant;
  /** Identifiants des textes masqués « confiance faible / moyenne » (aria-describedby). */
  lowConfidenceId?: string;
  mediumConfidenceId?: string;
  /** Entrée sur une valeur à vérifier non modifiée : la valeur est marquée comme relue. */
  onMarkChecked?: () => void;
  /** Collage de plusieurs valeurs ; renvoie vrai si le collage a été traité. */
  onPasteValues?: (values: ParsedCell[]) => boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const low = m?.confidence === "low";
  const medium = m?.confidence === "medium";
  const title = m ? (low ? fr.ai.lowConfidence : medium ? fr.ai.mediumConfidence : undefined) : fr.common.notDetected;
  const describedBy = [low ? lowConfidenceId : medium ? mediumConfidenceId : undefined, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  function commit(raw: string) {
    setDraft(raw);
    const p = parseCell(raw, max);
    if (p === "invalid") return setInvalid(true);
    setInvalid(false);
    onChange(toMeasure(p));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    props.onKeyDown?.(e);
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      setDraft(null);
      setInvalid(false);
      onChange({ value: null, confidence: "high", noResponse: true });
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && low && draft === null) onMarkChecked?.();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    if (!onPasteValues) return;
    const values = parsePastedValues(e.clipboardData.getData("text"));
    if (values && onPasteValues(values)) {
      e.preventDefault();
      setDraft(null);
      setInvalid(false);
    }
  }

  return (
    <span className={cn("relative block", variant === "cell" && "h-full")}>
      <input
        {...props}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        title={invalid ? crFr.grid.invalid : title}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        value={draft ?? cellText(m)}
        placeholder="—"
        data-confidence={m?.confidence}
        onChange={(e) => commit(e.target.value)}
        onFocus={(e) => {
          props.onFocus?.(e);
          e.currentTarget.select();
        }}
        onBlur={(e) => {
          props.onBlur?.(e);
          setDraft(null);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className={cn(
          VARIANT_CLASS[variant],
          low && "bg-warning font-semibold text-warning-foreground hover:bg-warning focus:bg-warning dark:bg-warning dark:focus:bg-warning",
          invalid && "text-destructive ring-2 ring-destructive ring-inset",
          className,
        )}
      />
      {low ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute size-0 border-t-[7px] border-l-[7px] border-t-warning-foreground border-l-transparent",
            variant === "cell" ? "top-0 right-0" : "top-1 right-1",
          )}
        />
      ) : medium ? (
        <span aria-hidden className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-warning-border" />
      ) : null}
    </span>
  );
}
