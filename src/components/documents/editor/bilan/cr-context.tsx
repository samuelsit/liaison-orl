"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { generateCommentAction } from "@/server/actions/ai";
import type { Audiometry } from "@/lib/schemas/audiometry";
import type { CompteRenduData } from "@/lib/schemas/document";
import { crFr } from "@/lib/i18n/compte-rendu";
import { useEditor } from "../editor-context";
import { commentFactsSignature, isCommentStale, readCommentFacts, writeCommentFacts } from "./comment-facts";

const C = crFr.comment;

export type CommentStyle = "standard" | "court" | "detaille" | "technique";

/** État du bilan publié par le panneau du bilan (lecture seule pour le reste du formulaire). */
export interface BilanSnapshot {
  attachmentId: string | null;
  audiometry: Audiometry | null;
  confirmed: boolean;
}

export interface CommentRunOptions {
  /** Valeurs à jour pas encore répercutées dans l'éditeur (degré proposé à la confirmation…). */
  data?: Partial<CompteRenduData>;
  /** Rédaction automatique après la confirmation des mesures. */
  auto?: boolean;
}

interface CompteRenduUi {
  bilan: BilanSnapshot;
  setBilan: (b: BilanSnapshot) => void;
  /** Ouvre la vérification du bilan (null tant que le panneau ne l'a pas fournie). */
  openReview: (() => void) | null;
  setOpenReview: (fn: (() => void) | null) => void;
  comment: {
    pending: CommentStyle | null;
    /** Le formulaire a changé depuis la rédaction par l'IA. */
    stale: boolean;
    canRestore: boolean;
    run: (style: CommentStyle, opts?: CommentRunOptions) => Promise<boolean>;
    restorePrevious: () => void;
  };
}

const EMPTY_BILAN: BilanSnapshot = { attachmentId: null, audiometry: null, confirmed: false };

const fallback: CompteRenduUi = {
  bilan: EMPTY_BILAN,
  setBilan: () => {},
  openReview: null,
  setOpenReview: () => {},
  comment: { pending: null, stale: false, canRestore: false, run: async () => false, restorePrevious: () => {} },
};

const Ctx = createContext<CompteRenduUi | null>(null);

/** État partagé du compte rendu (bilan, rédaction du commentaire) entre le panneau du bilan, les champs et l'assistant. */
export function useCompteRenduUi(): CompteRenduUi {
  return useContext(Ctx) ?? fallback;
}

export function CompteRenduUiProvider({ children }: { children: ReactNode }) {
  const ed = useEditor<CompteRenduData>();
  const edRef = useRef(ed);
  useEffect(() => {
    edRef.current = ed;
  });
  const [bilan, setBilan] = useState<BilanSnapshot>(EMPTY_BILAN);
  const [openReview, setOpenReviewState] = useState<(() => void) | null>(null);
  const [pending, setPending] = useState<CommentStyle | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [recorded, setRecorded] = useState<string | null>(null);
  const documentId = ed.documentId;

  useEffect(() => {
    const id = requestAnimationFrame(() => setRecorded(readCommentFacts(documentId)));
    return () => cancelAnimationFrame(id);
  }, [documentId]);

  const setOpenReview = useCallback((fn: (() => void) | null) => setOpenReviewState(() => fn), []);

  const run = useCallback(async (style: CommentStyle, opts?: CommentRunOptions) => {
    const e = edRef.current;
    const data = { ...e.data, ...opts?.data } as CompteRenduData;
    const previous = e.data.comments;
    setPending(style);
    const res = await generateCommentAction(e.documentId, {
      data: { ...data, comments: e.aiFields.includes("comments") ? "" : data.comments },
      style,
      patientId: e.patient?.id ?? null,
      prescriberId: e.prescriber?.id ?? null,
    });
    setPending(null);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    edRef.current.suggest({ comments: res.data.comment }, ["comments"]);
    const signature = commentFactsSignature(data);
    writeCommentFacts(e.documentId, signature);
    setRecorded(signature);
    if (previous.trim()) setHistory((h) => [...h.slice(-4), previous]);
    toast.success(opts?.auto ? C.prewritten : C.written, {
      action: previous.trim() ? { label: crFr.grid.undo, onClick: () => edRef.current.update({ comments: previous }) } : undefined,
    });
    return true;
  }, []);

  const restorePrevious = useCallback(() => {
    const last = history.at(-1);
    if (last === undefined) return;
    edRef.current.update({ comments: last });
    setHistory((h) => h.slice(0, -1));
    toast.success(C.previousRestored);
  }, [history]);

  const stale = isCommentStale(ed.data, ed.aiFields, recorded);
  const value = useMemo<CompteRenduUi>(
    () => ({
      bilan,
      setBilan,
      openReview,
      setOpenReview,
      comment: { pending, stale, canRestore: history.length > 0, run, restorePrevious },
    }),
    [bilan, openReview, setOpenReview, pending, stale, history, run, restorePrevious],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
