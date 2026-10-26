"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reformulateMotifAction } from "@/server/actions/ai";
import type { AdressageData } from "@/lib/schemas/document";
import { useEditor } from "./editor-context";

/** Reformulation médicale sobre du motif « Autre » à partir de quelques mots. */
export function MotifAssistant() {
  const ed = useEditor<AdressageData>();
  const [pending, setPending] = useState(false);
  const notes = ed.data.autreText.trim();

  async function run() {
    setPending(true);
    const original = ed.data.autreText;
    const res = await reformulateMotifAction(ed.documentId, { notes: original, patientId: ed.patient?.id ?? null, prescriberId: ed.prescriber?.id ?? null });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    ed.suggest({ autreText: res.data.motif.slice(0, 600), motifNotes: original.slice(0, 1000) }, ["autreText"]);
    toast.success("Motif reformulé.", { action: { label: "Annuler", onClick: () => ed.update({ autreText: original }) } });
  }

  return (
    <Button type="button" variant="outline" size="sm" className="h-9" disabled={pending || notes.length < 3} onClick={run} data-testid="reformulate-motif">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
      Reformuler avec l&apos;IA
    </Button>
  );
}
