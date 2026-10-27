"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export interface RenderInfo {
  pages: number;
}

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";
    return m;
  });
  return pdfjsPromise;
}

/**
 * Aperçu exact : le PDF est généré par le serveur (même moteur que le document final)
 * puis dessiné avec pdf.js, ce qui fonctionne aussi sur téléphone et tablette.
 */
export function PdfPreview({
  request,
  onInfo,
  downloadUrl,
  label,
  toolbar = true,
  errorText = "L'aperçu n'a pas pu être généré. Vos saisies sont enregistrées.",
}: {
  /** Requête d'aperçu (méthode, URL, corps JSON). Toute modification relance le rendu. */
  request: { method: "GET" | "POST"; url: string; body?: string } | null;
  onInfo?: (info: RenderInfo | null) => void;
  downloadUrl?: string;
  label: string;
  /** Barre « Aperçu exact du PDF / Ouvrir / Télécharger » au-dessus de l'aperçu. */
  toolbar?: boolean;
  errorText?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const key = request ? `${request.method} ${request.url} ${request.body ?? ""}` : "";

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    let cancelled = false;
    const t = setTimeout(async () => {
      setState((s) => (s === "ready" ? "ready" : "loading"));
      try {
        const res = await fetch(request.url, {
          method: request.method,
          body: request.body,
          headers: request.body ? { "Content-Type": "application/json" } : undefined,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const infoHeader = res.headers.get("X-Render-Info");
        onInfo?.(infoHeader ? (JSON.parse(infoHeader) as RenderInfo) : null);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const pdfjs = await loadPdfJs();
        const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        const width = container.current?.clientWidth ?? 600;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvases: HTMLCanvasElement[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * ratio;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "rounded-md bg-white shadow-sm ring-1 ring-black/5";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${label} — page ${i} sur ${pdf.numPages}`);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          canvases.push(canvas);
        }
        if (cancelled || !container.current) return;
        container.current.replaceChildren(...canvases);
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        setBlobUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        setState("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError" || cancelled) return;
        console.error(err);
        setState("error");
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);

  useEffect(() => () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div className="relative">
      <div className={toolbar ? "mb-2 flex items-center justify-between gap-2" : "sr-only"}>
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          Aperçu exact du PDF
          {state === "loading" ? <Spinner className="size-3.5" /> : null}
        </span>
        <span className="flex gap-1">
          {blobUrl ? (
            <Button asChild variant="ghost" size="sm" className="h-9">
              <a href={blobUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Ouvrir
              </a>
            </Button>
          ) : null}
          {downloadUrl ? (
            <Button asChild variant="ghost" size="sm" className="h-9">
              <a href={downloadUrl}>
                <Download aria-hidden /> Télécharger
              </a>
            </Button>
          ) : null}
        </span>
      </div>
      {state === "error" ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground" role="alert">
          {errorText}
          <Button variant="outline" size="sm" onClick={() => setRetry((r) => r + 1)}>
            <RefreshCw aria-hidden /> Réessayer
          </Button>
        </div>
      ) : null}
      {state === "idle" || (state === "loading" && !blobUrl) ? <Skeleton className="aspect-[210/297] w-full rounded-md" /> : null}
      <div ref={container} className="space-y-4" aria-live="polite" data-testid="pdf-preview" />
    </div>
  );
}
