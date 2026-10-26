"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

/** Touches nommées ; toute autre chaîne est affichée telle quelle (en majuscule si c'est une lettre). */
type NamedKey = "mod" | "enter" | "shift" | "alt" | "escape"
type ShortcutKey = NamedKey | (string & {})

const noopSubscribe = () => () => {}

function detectApplePlatform() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/**
 * Vrai sur macOS / iOS (touche ⌘). Le rendu serveur suppose « Ctrl » (postes
 * Windows majoritaires) puis s'aligne sur la plateforme à l'hydratation.
 */
function useIsApplePlatform() {
  return React.useSyncExternalStore(noopSubscribe, detectApplePlatform, () => false)
}

function keyLabel(key: ShortcutKey, apple: boolean): string {
  switch (key) {
    case "mod":
      return apple ? "⌘" : "Ctrl"
    case "enter":
      return "↵"
    case "shift":
      return "⇧"
    case "alt":
      return apple ? "⌥" : "Alt"
    case "escape":
      return "Échap"
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

/** Raccourci clavier adapté à la plateforme, masqué sur les écrans tactiles. */
function Shortcut({
  keys,
  className,
  ...props
}: Omit<React.ComponentProps<"kbd">, "children"> & { keys: readonly ShortcutKey[] }) {
  const apple = useIsApplePlatform()
  const labels = keys.map((k) => keyLabel(k, apple))

  // Sur Mac, les symboles se lisent accolés dans une seule touche (⌘K) ; ailleurs, une touche par élément (Ctrl K).
  if (apple) {
    return (
      <Kbd data-shortcut className={cn("pointer-coarse:hidden!", className)} {...props}>
        {labels.join("")}
      </Kbd>
    )
  }
  return (
    <KbdGroup data-shortcut className={cn("pointer-coarse:hidden!", className)} {...props}>
      {labels.map((label, i) => (
        <Kbd key={i}>{label}</Kbd>
      ))}
    </KbdGroup>
  )
}

export { Shortcut, useIsApplePlatform, keyLabel, type ShortcutKey }
