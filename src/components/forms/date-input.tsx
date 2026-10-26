"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatIsoDate, parseFrenchDate } from "@/lib/dates";

/**
 * Saisie rapide d'une date au format JJ/MM/AAAA (barres ajoutées automatiquement).
 * Renvoie une date ISO AAAA-MM-JJ, ou "" si vide.
 */
export function DateInput({
  id,
  value,
  onChange,
  onValidityChange,
  className,
  placeholder = "JJ/MM/AAAA",
  ...rest
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  onValidityChange?: (invalid: boolean) => void;
  className?: string;
  placeholder?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "id" | "onInvalid">) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatIsoDate(value);

  function handle(raw: string) {
    let v = raw.replace(/[^\d/]/g, "");
    const digits = v.replace(/\//g, "");
    if (!v.includes("/") && digits.length > 2) {
      v = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
    }
    setDraft(v);
    if (v === "") {
      onValidityChange?.(false);
      onChange("");
      return;
    }
    const iso = v.length >= 8 ? parseFrenchDate(v) : null;
    onValidityChange?.(!iso);
    if (iso) onChange(iso);
  }

  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      maxLength={10}
      value={shown}
      onChange={(e) => handle(e.target.value)}
      onBlur={() => setDraft(null)}
      className={className}
      {...rest}
    />
  );
}
