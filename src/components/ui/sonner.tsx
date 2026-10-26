"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/* Notifications neutres (surface de popover) : seule l'icône porte la couleur du ton. */
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success-foreground" />,
        info: <InfoIcon className="size-4 text-info-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-warning-foreground" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      {...props}
      toastOptions={{
        closeButtonAriaLabel: "Fermer la notification",
        ...toastOptions,
        classNames: {
          toast: "cn-toast shadow-lg! gap-2.5! font-sans!",
          title: "font-medium!",
          description: "text-muted-foreground! text-meta!",
          actionButton: "bg-primary! text-primary-foreground! rounded-md! font-medium!",
          cancelButton: "bg-muted! text-foreground! rounded-md!",
          closeButton: "bg-popover! border-border! text-muted-foreground! hover:text-foreground!",
          ...toastOptions?.classNames,
        },
      }}
    />
  )
}

export { Toaster }
