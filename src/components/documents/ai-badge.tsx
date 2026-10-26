"use client";

import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * Badge « Suggéré par l'IA » affiché jusqu'à validation humaine du champ.
 * Avec `onAccept`, un segment « Valider » (zone de clic élargie à ~44 px) confirme la suggestion.
 */
export function AiBadge({ onAccept, className }: { onAccept?: () => void; className?: string }) {
  return (
    <Badge tone="ai" data-testid="ai-badge" className={cn(onAccept && "overflow-visible pr-0", className)}>
      <Sparkles aria-hidden />
      {fr.ai.suggested}
      {onAccept ? (
        <button
          type="button"
          onClick={onAccept}
          aria-label={fr.ai.accept}
          title={fr.ai.accept}
          className="relative ml-0.5 inline-flex items-center gap-1 self-stretch rounded-r-full border-l border-ai-foreground/20 pr-2 pl-1.5 font-medium transition-colors duration-150 after:absolute after:-inset-x-1 after:-inset-y-2.5 hover:bg-ai-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <Check className="size-3" aria-hidden />
          <span className="max-sm:sr-only">{fr.ai.acceptShort}</span>
        </button>
      ) : null}
    </Badge>
  );
}
