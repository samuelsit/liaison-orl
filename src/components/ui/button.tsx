import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/*
 * Compact au pointeur fin, au moins 44 px au toucher (pointer-coarse).
 * Un seul bouton principal (variant "default") par zone de l'écran.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] duration-150 outline-none select-none pointer-coarse:min-h-11 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85",
        outline:
          "border-input bg-card text-foreground shadow-xs hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted",
        secondary:
          "bg-muted text-foreground hover:bg-muted/70 aria-expanded:bg-muted/70 dark:hover:bg-white/8",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/15 dark:hover:bg-destructive/20 dark:focus-visible:ring-destructive/40",
        "destructive-solid":
          "bg-destructive-fill text-white shadow-xs hover:bg-destructive-fill/90 active:bg-destructive-fill/85 focus-visible:border-destructive-fill focus-visible:ring-destructive-fill/30",
        link: "text-brand-fg underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-meta in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 text-[15px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9 pointer-coarse:min-w-11",
        "icon-xs":
          "size-7 rounded-md pointer-coarse:min-w-11 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-8 rounded-md pointer-coarse:min-w-11 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
