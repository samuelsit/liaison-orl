"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, FileText, FileUp, ScanLine, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shortcut } from "@/components/ui/shortcut";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";

const B = crFr.bilan;

export type UploadStep = "uploading" | "reading" | "extracting";
const STEPS: UploadStep[] = ["uploading", "reading", "extracting"];

/** Zone de dépôt du bilan (état vide) : photo en premier sur téléphone, collage d'une capture sur ordinateur. */
export function BilanDropzone({ onChoose, onCamera, highlighted }: { onChoose: () => void; onCamera: () => void; highlighted?: boolean }) {
  return (
    // Zone cliquable pour la souris ; au clavier, les boutons sont l'accès principal.
    <div
      data-testid="bilan-dropzone"
      data-drag={highlighted || undefined}
      onClick={onChoose}
      className="flex cursor-pointer flex-col items-center gap-4 rounded-xl border border-dashed border-input bg-surface-subtle px-5 py-7 text-center transition-colors duration-150 hover:border-foreground/25 hover:bg-muted/50 data-drag:border-ring data-drag:bg-accent/60 sm:py-8"
    >
      <span aria-hidden className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <ScanLine className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{B.dropTitle}</p>
        <p className="text-meta text-muted-foreground">{B.dropSubtitle}</p>
      </div>
      <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row" onClick={(e) => e.stopPropagation()}>
        <Button type="button" size="lg" className="w-full sm:hidden" onClick={onCamera}>
          <Camera aria-hidden /> {B.takePhoto}
        </Button>
        <Button type="button" variant="outline" className="max-sm:h-11 max-sm:w-full" onClick={onChoose}>
          <FileUp aria-hidden /> {B.chooseFile}
        </Button>
        <span className="hidden items-center gap-1.5 text-meta text-muted-foreground sm:inline-flex pointer-coarse:hidden">
          {B.pasteHint} <Shortcut keys={["mod", "v"]} />
        </span>
      </div>
    </div>
  );
}

/**
 * Dépôt n'importe où sur la page : un voile apparaît dès qu'un fichier est glissé
 * au-dessus de la fenêtre ; Échap ou sortie de la fenêtre l'annule.
 */
export function BilanDropOverlay({ enabled, onFile }: { enabled: boolean; onFile: (file: File) => void }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const onFileRef = useRef(onFile);
  useEffect(() => {
    onFileRef.current = onFile;
  });

  useEffect(() => {
    if (!enabled) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    function enter(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth.current += 1;
      setActive(true);
    }
    function over(e: DragEvent) {
      if (hasFiles(e)) e.preventDefault();
    }
    function leave(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    }
    function drop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      const file = e.dataTransfer?.files[0];
      if (file) onFileRef.current(file);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        depth.current = 0;
        setActive(false);
      }
    }
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("keydown", key);
      depth.current = 0;
    };
  }, [enabled]);

  if (!enabled || !active) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ring bg-card px-6 py-10 text-center shadow-lg">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <ScanLine className="size-6" />
        </span>
        <p className="text-base font-semibold">{B.overlayTitle}</p>
        <p className="text-meta text-muted-foreground">{B.overlayHint}</p>
      </div>
    </div>,
    document.body,
  );
}

function Thumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    const id = requestAnimationFrame(() => setUrl(u));
    return () => {
      cancelAnimationFrame(id);
      URL.revokeObjectURL(u);
    };
  }, [file]);
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) du fichier déposé
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <FileText className="size-5" aria-hidden />
      )}
    </span>
  );
}

/** Progression de la lecture : fichier, étapes, aperçu de ce qui arrive. */
export function BilanProgress({ file, step }: { file: File | null; step: UploadStep }) {
  const current = STEPS.indexOf(step);
  return (
    <div data-testid="bilan-progress" aria-live="polite" className="space-y-4 rounded-xl border bg-surface-subtle p-4">
      {file ? (
        <div className="flex min-w-0 items-center gap-3">
          <Thumbnail file={file} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-meta text-muted-foreground tabular-nums">{B.fileSize(file.size)}</p>
          </div>
        </div>
      ) : null}
      <ol className="grid grid-cols-3 gap-2" aria-label={B.progressTitle}>
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="min-w-0 space-y-2">
              <div className="h-1 overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={false}
                  animate={{ width: done ? "100%" : active ? "55%" : "0%" }}
                  transition={{ duration: DURATION.slow * 2, ease: EASE_OUT }}
                />
              </div>
              <p className={cn("flex items-center gap-1.5 text-meta", done || active ? "text-foreground" : "text-muted-foreground")}>
                {done ? <Check className="size-3.5 shrink-0 text-success-foreground" aria-hidden /> : active ? <Spinner className="size-3.5 shrink-0" aria-hidden /> : null}
                <span className="truncate">{B.steps[s]}</span>
                <span className="sr-only">{done ? ` (${B.stepDone})` : active ? ` (${B.stepCurrent})` : ""}</span>
              </p>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Skeleton className="h-28 rounded-lg sm:h-32" />
        <div className="space-y-2">
          <Skeleton className="h-6 rounded-md" />
          <Skeleton className="h-6 rounded-md" />
          <Skeleton className="h-6 rounded-md" />
          <Skeleton className="h-6 w-2/3 rounded-md" />
        </div>
      </div>
      <p className="text-meta text-muted-foreground">{B.progressHint}</p>
    </div>
  );
}

/** Lecture impossible : message du serveur et actions de reprise. */
export function BilanError({
  message,
  onManual,
  onChooseOther,
  onRetakePhoto,
}: {
  message: string;
  onManual?: () => void;
  onChooseOther: () => void;
  onRetakePhoto: () => void;
}) {
  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden />
      <AlertTitle>{B.readFailedTitle}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {onManual ? (
            <Button type="button" size="sm" variant="outline" onClick={onManual}>
              {B.manualEntry}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={onChooseOther}>
            <FileUp aria-hidden /> {B.chooseOther}
          </Button>
          <Button type="button" size="sm" variant="outline" className="sm:hidden" onClick={onRetakePhoto}>
            <Camera aria-hidden /> {B.retakePhoto}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
