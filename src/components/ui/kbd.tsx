import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-0.5 rounded border border-border bg-card px-1 font-sans text-2xs font-medium text-muted-foreground shadow-[0_1px_0_var(--border)] select-none",
        // Dans un bouton plein : touche au contour seul, sur le fond du bouton (le contraste
        // texte / aplat reste celui du bouton, garanti ≥ 4.5:1 quelle que soit la marque).
        "in-[[data-slot=button][data-variant=default]]:border-current/35 in-[[data-slot=button][data-variant=default]]:bg-transparent in-[[data-slot=button][data-variant=default]]:text-current in-[[data-slot=button][data-variant=default]]:shadow-none in-[[data-slot=button][data-variant=destructive-solid]]:border-current/35 in-[[data-slot=button][data-variant=destructive-solid]]:bg-transparent in-[[data-slot=button][data-variant=destructive-solid]]:text-current in-[[data-slot=button][data-variant=destructive-solid]]:shadow-none",
        // Dans une infobulle (fond inversé) : touche translucide.
        "in-data-[slot=tooltip-content]:border-background/20 in-data-[slot=tooltip-content]:bg-background/15 in-data-[slot=tooltip-content]:text-background in-data-[slot=tooltip-content]:shadow-none",
        "[&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
