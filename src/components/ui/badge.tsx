import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/*
 * Pastilles d'état ou d'étiquette. Le ton porte le sens (jamais la couleur de
 * marque pour un statut) ; `dot` ajoute un point pour ne pas dépendre de la couleur seule.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border [a]:hover:bg-muted/70",
        info: "bg-info text-info-foreground ring-info-border/60",
        success: "bg-success text-success-foreground ring-success-border/60",
        warning: "bg-warning text-warning-foreground ring-warning-border/50",
        danger: "bg-destructive/10 text-destructive ring-destructive/20",
        ai: "bg-ai text-ai-foreground ring-ai-border/60",
        brand: "bg-accent text-accent-foreground ring-ring/20",
        outline: "text-foreground ring-border [a]:hover:bg-muted",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>

/** Anciens noms de variantes shadcn, conservés comme alias des tons. */
const VARIANT_TONE = {
  default: "brand",
  secondary: "neutral",
  destructive: "danger",
  outline: "outline",
  ghost: "neutral",
  link: "outline",
} as const satisfies Record<string, BadgeTone>

type BadgeVariant = keyof typeof VARIANT_TONE

function Badge({
  className,
  tone,
  variant,
  dot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: BadgeTone
  /** @deprecated Utiliser `tone`. */
  variant?: BadgeVariant
  /** Point coloré avant le libellé ; "pulse" pour un état en cours. */
  dot?: boolean | "pulse"
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "span"
  const resolved: BadgeTone = tone ?? (variant ? VARIANT_TONE[variant] : "neutral")

  return (
    <Comp
      data-slot="badge"
      data-tone={resolved}
      className={cn(badgeVariants({ tone: resolved }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          data-slot="badge-dot"
          className={cn("size-1.5 shrink-0 rounded-full bg-current", dot === "pulse" && "animate-pulse")}
        />
      ) : null}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  )
}

export { Badge, badgeVariants, type BadgeTone }
