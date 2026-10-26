"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import { fr } from "@/lib/i18n/fr"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150 dark:bg-black/60",
        className
      )}
      {...props}
    />
  )
}

/*
 * Mise en page : en-tête et pied fixes, corps défilant (DialogBody).
 * Sous 640 px, le même élément devient une feuille ancrée en bas (CSS seul :
 * un unique role="dialog").
 */
const dialogSizes = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const

function DialogContent({
  className,
  children,
  size = "md",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** sm : confirmations · md : formulaires simples · lg : fiches patient / prescripteur · xl : aperçus. */
  size?: keyof typeof dialogSizes
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,860px)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-popover text-sm text-popover-foreground shadow-xl duration-200 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95",
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:data-open:slide-in-from-bottom max-sm:data-closed:slide-out-to-bottom",
          dialogSizes[size],
          className
        )}
        {...props}
      >
        <div aria-hidden data-slot="dialog-handle" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden" />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">{fr.common.close}</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 px-5 pt-3 pr-12 pb-4 sm:px-6 sm:pt-5 sm:pr-12",
        className
      )}
      {...props}
    />
  )
}

/**
 * Contenu défilant entre l'en-tête et le pied, qui restent visibles. Un
 * DialogFooter placé à l'intérieur (fin d'un <form>) reste collé en bas.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t bg-surface-subtle px-5 py-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6",
        // Placé à la fin d'un formulaire dans DialogBody : reste collé en bas de la zone défilante.
        "in-data-[slot=dialog-body]:sticky in-data-[slot=dialog-body]:-bottom-5 in-data-[slot=dialog-body]:z-10 in-data-[slot=dialog-body]:-mx-5 in-data-[slot=dialog-body]:mt-5 in-data-[slot=dialog-body]:-mb-5 sm:in-data-[slot=dialog-body]:-mx-6",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{fr.common.close}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-lg leading-7 font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
