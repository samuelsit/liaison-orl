"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownToLine, CheckCircle2, Loader2, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Shortcut } from "@/components/ui/shortcut";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudiometryEditor, type AudiometryEditorApi } from "@/components/audiology/audiometry-editor";
import { countMeasures } from "@/lib/audiology/calculations";
import { listLowConfidence } from "@/components/audiology/measure-cells";
import type { Audiometry } from "@/lib/schemas/audiometry";
import { fr } from "@/lib/i18n/fr";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";
import type { AttachmentView } from "../bilan-panel";
import { BilanOriginalViewer } from "./bilan-original-viewer";
import { FileChip } from "./file-chip";

const R = crFr.review;

const LG_QUERY = "(min-width: 1024px)";
function subscribeLg(cb: () => void) {
  const mql = window.matchMedia(LG_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function useIsLg() {
  return useSyncExternalStore(subscribeLg, () => window.matchMedia(LG_QUERY).matches, () => true);
}

/**
 * Vérification du bilan en plein écran : bilan d'origine à gauche, mesures et
 * audiogrammes à droite (onglets sous 1024 px). Pied fixe : valeur suivante à
 * vérifier, « Plus tard », « Confirmer les mesures » (Ctrl/⌘ + Entrée).
 */
export function BilanReviewDialog({
  open,
  onOpenChange,
  attachment,
  audiometry,
  onChange,
  readOnly,
  confirmed,
  confirming,
  onConfirm,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: AttachmentView | null;
  audiometry: Audiometry;
  onChange: (a: Audiometry) => void;
  readOnly: boolean;
  confirmed: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const isLg = useIsLg();
  const editor = useRef<AudiometryEditorApi>(null);
  const [tab, setTab] = useState<"measures" | "original">("measures");
  const [originalSeen, setOriginalSeen] = useState(false);
  const low = listLowConfidence(audiometry).length;
  const count = countMeasures(audiometry);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  });

  // Ctrl/⌘ + Entrée confirme les mesures (et non la validation du document) tant que la vérification est ouverte.
  useEffect(() => {
    if (!open || readOnly) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        confirmRef.current();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, readOnly]);

  const editorPane = (
    <AudiometryEditor ref={editor} value={audiometry} onChange={onChange} readOnly={readOnly} />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="h-dvh max-h-dvh w-screen max-w-none rounded-none border-0 [--chart-surface:var(--popover)] max-sm:max-h-dvh max-sm:rounded-none sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[1600px] sm:rounded-2xl sm:border [&>[data-slot=dialog-handle]]:hidden"
      >
        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base sm:text-lg">{readOnly ? R.readOnlyTitle : R.title}</DialogTitle>
            <DialogDescription className="truncate text-meta max-sm:sr-only">{readOnly ? R.readOnlyDescription : R.description}</DialogDescription>
          </div>
          {attachment ? <FileChip name={attachment.fileName} size={attachment.size} mimeType={attachment.mimeType} className="max-md:hidden" /> : null}
          {!readOnly ? (
            low > 0 ? (
              <Badge tone="warning" dot>
                {R.toCheck(low)}
              </Badge>
            ) : (
              <Badge tone="success">
                <CheckCircle2 aria-hidden /> {R.allChecked}
              </Badge>
            )
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
              <XIcon aria-hidden />
              <span className="sr-only">{fr.common.close}</span>
            </Button>
          </DialogClose>
        </header>

        {isLg ? (
          <div className={cn("grid min-h-0 flex-1", attachment ? "grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] divide-x" : "grid-cols-1")}>
            {attachment ? <BilanOriginalViewer attachmentId={attachment.id} mimeType={attachment.mimeType} className="h-full" /> : null}
            <div className="scroll-thin min-h-0 overflow-y-auto px-5 pt-5 pb-8">{editorPane}</div>
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "measures" | "original");
              if (v === "original") setOriginalSeen(true);
            }}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            {attachment ? (
              <div className="shrink-0 px-4 pt-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="measures">{R.tabMeasures}</TabsTrigger>
                  <TabsTrigger value="original">{R.tabOriginal}</TabsTrigger>
                </TabsList>
              </div>
            ) : null}
            <TabsContent value="measures" className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-8">
              {editorPane}
            </TabsContent>
            {attachment ? (
              <TabsContent value="original" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
                {originalSeen ? <BilanOriginalViewer attachmentId={attachment.id} mimeType={attachment.mimeType} className="h-full" /> : null}
              </TabsContent>
            ) : null}
          </Tabs>
        )}

        <footer className="flex shrink-0 items-center gap-2 border-t bg-surface-subtle px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {readOnly ? (
            <>
              <span className="text-meta text-muted-foreground">{crFr.bilan.measuresCount(count)}</span>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="ml-auto">
                  {fr.common.close}
                </Button>
              </DialogClose>
            </>
          ) : (
            <>
              {low > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!isLg) setTab("measures");
                    requestAnimationFrame(() => editor.current?.focusNextLow());
                  }}
                  aria-label={R.next}
                >
                  <ArrowDownToLine aria-hidden />
                  <span className="max-sm:hidden">{R.next}</span>
                </Button>
              ) : (
                <span className="truncate text-meta text-muted-foreground max-sm:hidden">{R.autosave}</span>
              )}
              <div className="ml-auto flex min-w-0 items-center gap-2 max-sm:flex-1 max-sm:justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {R.later}
                  </Button>
                </DialogClose>
                <Button type="button" onClick={onConfirm} disabled={confirming || !attachment} data-testid="confirm-measures" className="max-sm:flex-1">
                  {confirming ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
                  {confirmed ? R.done : R.confirm}
                  <Shortcut keys={["mod", "enter"]} className="ml-1 max-lg:hidden" />
                </Button>
              </div>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
