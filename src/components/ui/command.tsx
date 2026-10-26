"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchIcon, CheckIcon } from "lucide-react"
import { fr } from "@/lib/i18n/fr"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground in-data-[slot=dialog-content]:rounded-none in-data-[slot=dialog-content]:p-0",
        className
      )}
      {...props}
    />
  )
}

/*
 * Palette de commandes : ancrée en haut de l'écran (la liste grandit vers le
 * bas sans déplacer le champ), plein écran sur téléphone.
 */
function CommandDialog({
  title = "Palette de commandes",
  description = "Rechercher une commande…",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        size="lg"
        className={cn(
          "top-[15vh] translate-y-0 sm:max-h-[min(70dvh,560px)] sm:max-w-xl",
          "max-sm:top-0 max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=command-input-wrapper]]:pr-24 *:data-[slot=dialog-handle]:hidden",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {/* Titre accessible dans le contenu du dialogue (et non dans la page, hors repère). */}
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        {showCloseButton ? null : (
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="absolute top-0.5 right-1 sm:hidden">
              {fr.common.close}
            </Button>
          </DialogClose>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex shrink-0 items-center gap-2 rounded-lg border border-input bg-card px-2.5 shadow-xs has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/20 dark:bg-input/20 in-data-[slot=dialog-content]:h-12 in-data-[slot=dialog-content]:rounded-none in-data-[slot=dialog-content]:border-0 in-data-[slot=dialog-content]:border-b in-data-[slot=dialog-content]:border-border in-data-[slot=dialog-content]:bg-transparent in-data-[slot=dialog-content]:px-4 in-data-[slot=dialog-content]:shadow-none in-data-[slot=dialog-content]:ring-0 in-data-[slot=dialog-content]:has-focus-visible:border-border in-data-[slot=dialog-content]:has-focus-visible:ring-0"
    >
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "h-9 w-full min-w-0 bg-transparent text-base outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11 md:text-sm in-data-[slot=dialog-content]:h-12 in-data-[slot=dialog-content]:md:text-base",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "scroll-thin max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto pt-1 outline-none in-data-[slot=dialog-content]:max-h-none in-data-[slot=dialog-content]:min-h-0 in-data-[slot=dialog-content]:flex-1 in-data-[slot=dialog-content]:scroll-py-2 in-data-[slot=dialog-content]:p-2",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex min-h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-hidden select-none pointer-coarse:min-h-11 in-data-[slot=dialog-content]:min-h-10 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground dark:data-selected:bg-white/10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs text-muted-foreground group-data-selected/command-item:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
