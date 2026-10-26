"use client";

import { Fragment } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { keyLabel, useIsApplePlatform, type ShortcutKey } from "@/components/ui/shortcut";
import { shellFr } from "@/lib/i18n/shell";
import { cn } from "@/lib/utils";

/**
 * Séquence de deux touches (« G puis D ») pour la navigation au clavier.
 * Masquée au toucher, comme <Shortcut>. `withThen` intercale « puis » (aide clavier).
 */
export function KeySequence({
  keys,
  withThen = false,
  alwaysVisible = false,
  className,
}: {
  keys: readonly string[];
  withThen?: boolean;
  /** Dans l'aide clavier : visible même sur écran tactile (tablette avec clavier). */
  alwaysVisible?: boolean;
  className?: string;
}) {
  return (
    <KbdGroup data-shortcut className={cn(!alwaysVisible && "pointer-coarse:hidden!", className)}>
      {keys.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && withThen ? <span className="font-sans text-2xs text-muted-foreground">{shellFr.help.then}</span> : null}
          <Kbd>{k.length === 1 ? k.toUpperCase() : k}</Kbd>
        </Fragment>
      ))}
    </KbdGroup>
  );
}

/** Combinaison adaptée à la plateforme (Ctrl ou ⌘), toujours visible : réservée à l'aide clavier. */
export function KeyCombo({ keys, className }: { keys: readonly ShortcutKey[]; className?: string }) {
  const apple = useIsApplePlatform();
  return (
    <KbdGroup data-shortcut className={className}>
      {keys.map((k, i) => (
        <Kbd key={i}>{keyLabel(k, apple)}</Kbd>
      ))}
    </KbdGroup>
  );
}
