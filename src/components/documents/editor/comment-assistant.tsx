"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateCommentAction } from "@/server/actions/ai";
import type { CompteRenduData } from "@/lib/schemas/document";
import type { AttachmentView } from "./bilan-panel";
import { useEditor } from "./editor-context";

type Style = "standard" | "court" | "detaille" | "technique";
const STYLE_LABEL: Record<Style, string> = { standard: "Régénérer", court: "Plus court", detaille: "Plus détaillé", technique: "Plus technique" };

/** Rédaction et régénération du commentaire par l'IA (valeurs calculées en code). */
export function CommentAssistant({ attachments: _attachments }: { attachments: AttachmentView[] }) {
  const ed = useEditor<CompteRenduData>();
  const [pending, setPending] = useState<Style | null>(null);
  const hasComment = ed.data.comments.trim().length > 0;
  const previous = ed.data.comments;

  async function run(style: Style) {
    setPending(style);
    const res = await generateCommentAction(ed.documentId, {
      data: { ...ed.data, comments: ed.aiFields.includes("comments") ? "" : ed.data.comments },
      style,
      patientId: ed.patient?.id ?? null,
      prescriberId: ed.prescriber?.id ?? null,
    });
    setPending(null);
    if (!res.ok) return void toast.error(res.error);
    ed.suggest({ comments: res.data.comment }, ["comments"]);
    toast.success("Commentaire rédigé : relisez-le avant de valider.", {
      action: hasComment ? { label: "Annuler", onClick: () => ed.update({ comments: previous }) } : undefined,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonGroup>
        <Button type="button" variant="outline" className="h-10" disabled={pending !== null} onClick={() => run("standard")} data-testid="generate-comment">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {hasComment ? STYLE_LABEL.standard : "Rédiger avec l'IA"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="h-10" disabled={pending !== null} aria-label="Autres versions">
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(["court", "detaille", "technique"] as const).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => run(s)}>
                {STYLE_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <span className="text-xs text-muted-foreground">
        {ed.data.attachmentId ? "S'appuie sur les mesures confirmées et le formulaire." : "Confirmez les mesures du bilan pour un commentaire chiffré."}
      </span>
    </div>
  );
}
