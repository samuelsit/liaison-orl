"use client"

import * as React from "react"
import { motion } from "motion/react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { LAYOUT_SPRING } from "@/lib/motion"

/*
 * Contrôle segmenté (filtres de statut, période, impression, thème…) : même
 * rendu que les onglets segmentés, sur un ToggleGroup à choix unique.
 * Une valeur est toujours sélectionnée (re-cliquer l'option active ne la vide pas).
 */

type SegmentedControlContextValue = {
  value: string
  layoutId?: string
  size: "sm" | "default"
}

const SegmentedControlContext =
  React.createContext<SegmentedControlContextValue | null>(null)

function SegmentedControl<T extends string>({
  className,
  value,
  onValueChange,
  fullWidth = false,
  layoutId,
  size = "default",
  children,
  ...props
}: Omit<
  ToggleGroupPrimitive.ToggleGroupSingleProps,
  "type" | "value" | "defaultValue" | "onValueChange"
> & {
  value: T
  onValueChange: (value: T) => void
  /** Occupe toute la largeur, segments de largeur égale. */
  fullWidth?: boolean
  /** Identifiant unique sur la page : anime la pastille active d'un segment à l'autre. */
  layoutId?: string
  size?: "sm" | "default"
}) {
  const context = React.useMemo(() => ({ value, layoutId, size }), [value, layoutId, size])

  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented-control"
      data-size={size}
      type="single"
      value={value}
      // Radix renvoie "" quand on re-clique l'option active : on l'ignore.
      onValueChange={(next) => {
        if (next) onValueChange(next as T)
      }}
      className={cn(
        "items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground dark:bg-black/25",
        fullWidth ? "grid w-full auto-cols-fr grid-flow-col" : "inline-flex w-fit",
        className
      )}
      {...props}
    >
      <SegmentedControlContext.Provider value={context}>
        {children}
      </SegmentedControlContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function SegmentedControlItem({
  className,
  value,
  count,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & {
  /** Compteur facultatif affiché après le libellé. */
  count?: number
}) {
  const context = React.useContext(SegmentedControlContext)
  const active = context?.value === value
  const animated = Boolean(context?.layoutId)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-control-item"
      value={value}
      className={cn(
        "relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        context?.size === "sm" ? "h-7 px-2.5 text-meta" : "h-8",
        !animated &&
          "data-[state=on]:bg-card data-[state=on]:shadow-xs dark:data-[state=on]:bg-white/10",
        className
      )}
      {...props}
    >
      {animated && active ? (
        <motion.span
          aria-hidden
          layoutId={context?.layoutId}
          transition={LAYOUT_SPRING}
          className="absolute inset-0 rounded-md bg-card shadow-xs dark:bg-white/10"
        />
      ) : null}
      <span className="relative inline-flex min-w-0 items-center gap-1.5 truncate">
        {children}
      </span>
      {typeof count === "number" ? (
        <span className="relative rounded-full bg-foreground/5 px-1.5 text-2xs font-medium tabular-nums dark:bg-white/10">
          {count}
        </span>
      ) : null}
    </ToggleGroupPrimitive.Item>
  )
}

export { SegmentedControl, SegmentedControlItem }
