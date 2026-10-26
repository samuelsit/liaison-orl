import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"
import { fr } from "@/lib/i18n/fr"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label={fr.common.loading} className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
