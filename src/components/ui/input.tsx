import * as React from "react"
import { cn } from "@/lib/utils"

/** Classes communes aux champs (Input, Textarea, SelectTrigger, déclencheurs de combobox). */
const fieldControlClassName =
  "w-full min-w-0 rounded-lg border border-input bg-card text-base shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:border-input aria-invalid:border-destructive aria-invalid:ring-destructive/15 md:text-sm dark:bg-input/20 dark:disabled:bg-muted dark:aria-invalid:ring-destructive/25"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClassName,
        "h-9 px-3 py-1 pointer-coarse:h-11 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input, fieldControlClassName }
