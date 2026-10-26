"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Toggle as TogglePrimitive } from "radix-ui"

/* État actif : teinte de marque + contour (jamais un aplat de marque). */
const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-150 outline-none pointer-coarse:min-h-11 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-transparent data-[state=on]:bg-muted data-[state=on]:text-foreground",
        outline:
          "border border-input bg-card shadow-xs hover:bg-muted data-[state=on]:border-ring data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:ring-1 data-[state=on]:ring-ring dark:bg-input/20 dark:data-[state=on]:bg-accent",
      },
      size: {
        default:
          "h-9 min-w-9 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        sm: "h-8 min-w-8 rounded-md px-2.5 text-meta has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 min-w-11 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
