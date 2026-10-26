"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shortcut } from "@/components/ui/shortcut";
import { useUnsavedChangesGuard } from "@/hooks/use-dirty-state";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { fr } from "@/lib/i18n/fr";
import { FloatingBar } from "./sticky-action-bar";

/**
 * Barre « Modifications non enregistrées » (cf. design §4.10.3) : apparaît dès qu'un
 * formulaire est modifié, propose [Annuler] et [Enregistrer] (Ctrl/⌘ + S), et demande
 * confirmation avant de quitter la page. Remplace tout bouton « Enregistrer » pleine largeur.
 *
 * - React Hook Form : `dirty={form.formState.isDirty}`, `onReset={() => form.reset()}`,
 *   `formId` = id du `<form onSubmit={form.handleSubmit(…)}>` (le bouton soumet ce formulaire).
 * - État local : `useDirtyState()` puis `dirty`, `onReset={reset}`, `onSave={save}`.
 */
export function SaveBar({
  dirty,
  saving = false,
  onSave,
  onReset,
  formId,
  message = fr.common.unsavedChanges,
  saveLabel = fr.common.save,
  disabled = false,
}: {
  dirty: boolean;
  saving?: boolean;
  /** Appelé par le bouton et par Ctrl/⌘ + S quand `formId` est absent. */
  onSave?: () => void;
  onReset?: () => void;
  /** Formulaire à soumettre (bouton `type="submit" form={formId}`). */
  formId?: string;
  message?: string;
  saveLabel?: string;
  /** Empêche l'enregistrement (formulaire invalide) sans masquer la barre. */
  disabled?: boolean;
}) {
  useUnsavedChangesGuard(dirty && !saving);

  function save() {
    if (!dirty || saving || disabled) return;
    if (formId) {
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) form.requestSubmit();
      return;
    }
    onSave?.();
  }

  useHotkeys(
    {
      "mod+s": (e) => {
        // Toujours bloquer « Enregistrer la page » du navigateur sur un écran de réglages.
        e.preventDefault();
        save();
      },
    },
    [dirty, saving, disabled, formId, onSave],
  );

  return (
    <FloatingBar open={dirty || saving} label={message}>
      <span role="status" className="flex min-w-0 flex-1 items-center gap-2 font-medium sm:flex-none">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning-border" />
        <span className="truncate">{message}</span>
      </span>
      <div className="flex shrink-0 items-center gap-2 sm:ml-2">
        {onReset ? (
          <Button type="button" variant="ghost" onClick={onReset} disabled={saving}>
            {fr.common.cancel}
          </Button>
        ) : null}
        <Button
          type={formId ? "submit" : "button"}
          form={formId}
          onClick={formId ? undefined : save}
          disabled={saving || disabled}
          aria-keyshortcuts="Control+S Meta+S"
        >
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {saving ? fr.common.saving : saveLabel}
          <Shortcut keys={["mod", "s"]} className="ml-0.5 max-sm:hidden" />
        </Button>
      </div>
    </FloatingBar>
  );
}
