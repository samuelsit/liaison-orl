"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { cleanDictationAction } from "@/server/actions/ai";
import type { DocumentData } from "@/lib/schemas/document";
import { useEditor } from "./editor-context";

/**
 * Dictée dans un champ texte : le texte brut s'ajoute au fil de l'eau, puis la portion
 * dictée est nettoyée par l'IA (ponctuation, termes médicaux) à la fin de la dictée.
 */
export function useDictation(field: "comments" | "autreText") {
  const ed = useEditor<DocumentData>();
  const session = useRef<{ before: string; dictated: string } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const current = () => String((ed.data as unknown as Record<string, unknown>)[field] ?? "");

  function onText(t: string) {
    if (!session.current) session.current = { before: current(), dictated: "" };
    const s = session.current;
    s.dictated = s.dictated ? `${s.dictated} ${t}` : t;
    const sep = s.before && !/\s$/.test(s.before) ? " " : "";
    ed.update({ [field]: `${s.before}${sep}${s.dictated}` } as Partial<DocumentData>);
  }

  async function onEnd() {
    const s = session.current;
    session.current = null;
    if (!s?.dictated.trim() || !ed.shared.aiEnabled) return;
    setCleaning(true);
    const res = await cleanDictationAction(ed.documentId, { text: s.dictated, patientId: ed.patient?.id ?? null, prescriberId: ed.prescriber?.id ?? null });
    setCleaning(false);
    if (!res.ok) return void toast.error(res.error);
    const sep = s.before && !/\s$/.test(s.before) ? " " : "";
    ed.suggest({ [field]: `${s.before}${sep}${res.data.text}` } as Partial<DocumentData>, [field]);
  }

  return { onText, onEnd, cleaning };
}
