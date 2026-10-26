"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minus, Plus, RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";

const V = crFr.viewer;
const ZOOMS = [1, 1.5, 2, 3] as const;

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";
    return m;
  });
  return pdfjsPromise;
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Largeur disponible du conteneur (px), suivie au redimensionnement. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function ImageView({ src, zoom, rotation }: { src: string; zoom: number; rotation: number }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const turned = rotation % 180 !== 0;
  const rw = natural ? (turned ? natural.h : natural.w) : 1;
  const rh = natural ? (turned ? natural.w : natural.h) : 1;
  const scale = natural && width ? (width / rw) * zoom : 0;

  return (
    <div ref={box} className="w-full">
      {failed ? (
        <p role="alert" className="py-10 text-center text-sm text-muted-foreground">
          {V.error}
        </p>
      ) : (
        <div className="relative mx-auto" style={natural && scale ? { width: rw * scale, height: rh * scale } : { width: "100%", aspectRatio: "3 / 4" }}>
          {!natural ? <Skeleton className="absolute inset-0 rounded-md" /> : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par l'API (accès journalisé), pas d'optimisation d'image */}
          <img
            src={src}
            alt={V.label}
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setFailed(true)}
            className={cn("absolute top-1/2 left-1/2 max-w-none rounded-sm bg-white shadow-md ring-1 ring-black/5 select-none", !natural && "opacity-0")}
            style={
              natural && scale
                ? { width: natural.w * scale, height: natural.h * scale, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }
                : { transform: "translate(-50%, -50%)" }
            }
          />
        </div>
      )}
    </div>
  );
}

function PdfView({ url, zoom }: { url: string; zoom: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const bytes = new Uint8Array(await res.arrayBuffer());
        const pdfjs = await loadPdfJs();
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const target = (holder.current?.clientWidth || 600) * 2;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvases: HTMLCanvasElement[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (target / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mx-auto block h-auto rounded-sm bg-white shadow-md ring-1 ring-black/5";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", V.page(i, pdf.numPages));
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          canvases.push(canvas);
        }
        if (cancelled || !holder.current) return;
        holder.current.replaceChildren(...canvases);
        setState("ready");
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [url, retry]);

  return (
    <div className="w-full">
      {state === "loading" ? <Skeleton className="mx-auto aspect-[210/297] w-full rounded-md" /> : null}
      {state === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
          {V.error}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setState("loading");
              setRetry((r) => r + 1);
            }}
          >
            <RefreshCw aria-hidden /> {V.retry}
          </Button>
        </div>
      ) : null}
      <div ref={holder} className="space-y-4 [&>canvas]:w-(--pdf-w)" style={{ "--pdf-w": `${zoom * 100}%` } as React.CSSProperties} />
    </div>
  );
}

/**
 * Bilan d'origine affiché à côté des mesures : image (zoom, rotation pour les photos)
 * ou PDF (pdf.js). Chaque affichage passe par la route des pièces jointes (consultation journalisée).
 */
export function BilanOriginalViewer({ attachmentId, mimeType, className }: { attachmentId: string; mimeType: string; className?: string }) {
  const url = `/api/pieces-jointes/${attachmentId}`;
  const isPdf = mimeType === "application/pdf";
  const [zoomIndex, setZoomIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const zoom = ZOOMS[zoomIndex]!;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div role="toolbar" aria-label={V.toolbar} className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => setZoomIndex(0)} disabled={zoomIndex === 0}>
          <Maximize2 aria-hidden /> {V.fit}
        </Button>
        <ToolButton label={V.zoomOut} onClick={() => setZoomIndex((z) => Math.max(0, z - 1))} disabled={zoomIndex === 0}>
          <Minus aria-hidden />
        </ToolButton>
        <span className="w-12 text-center text-meta text-muted-foreground tabular-nums" aria-live="polite">
          {V.zoom(Math.round(zoom * 100))}
        </span>
        <ToolButton label={V.zoomIn} onClick={() => setZoomIndex((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIndex === ZOOMS.length - 1}>
          <Plus aria-hidden />
        </ToolButton>
        {!isPdf ? (
          <ToolButton label={V.rotate} onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw aria-hidden />
          </ToolButton>
        ) : null}
        <span className="ml-auto" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon-sm">
              <a href={url} target="_blank" rel="noreferrer" aria-label={V.openTab}>
                <ExternalLink aria-hidden />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{V.openTab}</TooltipContent>
        </Tooltip>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label={V.label}
        className="scroll-thin min-h-0 flex-1 overflow-auto bg-muted/60 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset dark:bg-black/30"
      >
        {isPdf ? <PdfView url={url} zoom={zoom} /> : <ImageView src={url} zoom={zoom} rotation={rotation} />}
      </div>
    </div>
  );
}
