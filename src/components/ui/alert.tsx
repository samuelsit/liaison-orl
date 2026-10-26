import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/*
 * Tons sémantiques : fond teinté, bordure et texte dans la couleur du ton
 * (contraste AA vérifié en clair et en sombre, cf. globals.css).
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground *:[svg]:text-muted-foreground",
        info: "border-info-border bg-info text-info-foreground *:data-[slot=alert-description]:text-current",
        success:
          "border-success-border bg-success text-success-foreground *:data-[slot=alert-description]:text-current",
        warning:
          "border-warning-border/70 bg-warning text-warning-foreground *:data-[slot=alert-description]:text-current",
        ai: "border-ai-border bg-ai text-ai-foreground *:data-[slot=alert-description]:text-current",
        destructive:
          "border-destructive/30 bg-destructive/5 text-destructive *:data-[slot=alert-description]:text-current dark:bg-destructive/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-pretty text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2.5 right-2.5", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
