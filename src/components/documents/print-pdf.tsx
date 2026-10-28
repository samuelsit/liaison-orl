"use client";

import { useState, type ComponentProps } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { docFr } from "@/lib/i18n/documents";

const T = docFr.editor;

/** URL du PDF d'un document (affichage en ligne) et de son téléchargement. */
export const pdfUrls = (id: string) => ({
  inline: `/api/documents/${id}/pdf`,
  download: `/api/documents/${id}/pdf?telecharger=1`,
});

let current: { frame: HTMLIFrameElement; blobUrl: string } | null = null;

function cleanup() {
  if (!current) return;
  current.frame.remove();
  URL.revokeObjectURL(current.blobUrl);
  current = null;
}

/** Safari iOS / iPadOS imprime la page parente au lieu d'un PDF chargé dans un cadre. */
function printsFramesBadly(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Imprime le PDF exact (vectoriel) : il est chargé dans un cadre invisible de même origine
 * (blob:, autorisé par la CSP `frame-src`) dont on ouvre la boîte d'impression. Le cadre est
 * conservé jusqu'à l'impression suivante (le retirer trop tôt annule l'impression sous Firefox).
 */
async function printInFrame(url: string): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  const blob = new Blob([await res.arrayBuffer()], { type: "application/pdf" });
  cleanup();
  const blobUrl = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.title = T.print;
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.dataset.testid = "print-frame";
  // Ni display:none ni visibility:hidden : la visionneuse PDF ne se chargerait pas.
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "1px", height: "1px", border: "0", opacity: "0", pointerEvents: "none" });
  current = { frame, blobUrl };
  await new Promise<void>((resolve, reject) => {
    // Visionneuse PDF absente ou désactivée : le cadre ne se charge pas, on propose d'ouvrir le PDF.
    const timeout = setTimeout(() => reject(new Error("print-timeout")), 15_000);
    frame.onload = () =>
      // Laisse la visionneuse PDF s'initialiser avant d'ouvrir la boîte d'impression.
      setTimeout(() => {
        clearTimeout(timeout);
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error("print"));
        }
      }, 100);
    frame.src = blobUrl;
    document.body.appendChild(frame);
  });
}

/**
 * Ouvre la boîte d'impression du navigateur sur le PDF. À appeler depuis un geste de
 * l'utilisateur : sur iPhone / iPad, le PDF s'ouvre dans un nouvel onglet (Partager → Imprimer).
 */
export function startPrint(url: string): Promise<void> {
  if (printsFramesBadly()) {
    window.open(url, "_blank", "noopener");
    return Promise.resolve();
  }
  return printInFrame(url).catch((err: unknown) => {
    console.error(err);
    toast.error(T.printFailed, { action: { label: T.printFallback, onClick: () => window.open(url, "_blank", "noopener") } });
  });
}

/** Bouton « Imprimer » : boîte d'impression du navigateur sur le PDF du document. */
export function PrintPdfButton({ url, ...props }: { url: string } & Omit<ComponentProps<typeof Button>, "onClick" | "asChild">) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        setPending(true);
        void startPrint(url).finally(() => setPending(false));
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Printer aria-hidden />}
      {pending ? T.printing : T.print}
    </Button>
  );
}
