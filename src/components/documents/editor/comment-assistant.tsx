"use client";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { CompteRenduData } from "@/lib/schemas/document";
import { crFr } from "@/lib/i18n/compte-rendu";
import { useEditor } from "./editor-context";
import { useCompteRenduUi, type CommentStyle } from "./bilan/cr-context";

const C = crFr.comment;

/** Rédaction et régénération du commentaire par l'IA (valeurs calculées en code, bilan fusionné confirmé). */
export function CommentAssistant() {
  const ed = useEditor<CompteRenduData>();
  const cr = useCompteRenduUi();
  const pending = cr.comment.pending;
  const hasComment = ed.data.comments.trim().length > 0;

  const run = (style: CommentStyle) => void cr.comment.run(style);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonGroup>
        <Button type="button" variant="outline" className="h-10" disabled={pending !== null} onClick={() => run("standard")} data-testid="generate-comment">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {hasComment ? C.regenerate : C.generate}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="h-10" disabled={pending !== null} aria-label={C.moreVariants}>
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(["court", "detaille", "technique"] as const).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => run(s)}>
                {C.variants[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <span className="text-xs text-muted-foreground">{cr.bilan.confirmed ? C.basedOnMeasures : C.confirmFirst}</span>
    </div>
  );
}
