"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fr } from "@/lib/i18n/fr";
import { dispFr } from "@/lib/i18n/dispatch";
import type { Channel, DispatchStatus } from "@/lib/schemas/dispatch";
import { cn } from "@/lib/utils";
import { isErrorStatus } from "./dispatch-steps";

export const AUTO_REFRESH_MS = 30_000;

/** Envoi surveillé : un passage en erreur pendant la consultation déclenche une alerte. */
export interface WatchedDispatch {
  id: string;
  status: DispatchStatus;
  channel: Channel;
  recipientName: string;
}

/** Secondes écoulées depuis la dernière actualisation, rafraîchies toutes les 5 s. */
function useSecondsSince(since: number) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.round((Math.max(now, since) - since) / 1000));
}

/**
 * Actualisation discrète des statuts d'envoi : tant que `active` (au moins un envoi encore
 * en cours), la page est rechargée côté serveur toutes les 30 s, uniquement quand l'onglet est
 * visible (pause sinon, reprise immédiate au retour si l'intervalle est écoulé). Jamais au montage.
 * Affiche « Mis à jour il y a 12 s » et un bouton « Actualiser ».
 */
export function AutoRefresh({
  active,
  watch = [],
  onRefresh,
  className,
}: {
  active: boolean;
  watch?: WatchedDispatch[];
  /** Actualisation personnalisée (sinon router.refresh()). */
  onRefresh?: () => Promise<void> | void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lastAt, setLastAt] = useState(() => Date.now());
  const seconds = useSecondsSince(lastAt);
  const lastAtRef = useRef(lastAt);

  const refresh = useCallback(() => {
    start(async () => {
      if (onRefresh) await onRefresh();
      else router.refresh();
      const now = Date.now();
      lastAtRef.current = now;
      setLastAt(now);
    });
  }, [onRefresh, router]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAtRef.current >= AUTO_REFRESH_MS - 500) refresh();
    };
    const t = setInterval(tick, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, refresh]);

  // Alerte quand un envoi surveillé passe en erreur pendant la consultation.
  const previous = useRef(new Map(watch.map((w) => [w.id, w.status])));
  useEffect(() => {
    for (const w of watch) {
      const before = previous.current.get(w.id);
      if (before && !isErrorStatus(before) && isErrorStatus(w.status)) {
        toast.error(dispFr.refresh.errorToast(fr.channels[w.channel], w.recipientName), {
          description: fr.dispatchStatus[w.status],
          action: { label: dispFr.refresh.see, onClick: () => router.push(`/envois/${w.id}`) },
        });
      }
    }
    previous.current = new Map(watch.map((w) => [w.id, w.status]));
  }, [watch, router]);

  const label = seconds < 10 ? dispFr.refresh.justNow : dispFr.refresh.updatedAgo(seconds);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums" title={active ? dispFr.refresh.auto : undefined}>
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={refresh} disabled={pending} aria-label={dispFr.refresh.refresh} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{dispFr.refresh.refresh}</TooltipContent>
      </Tooltip>
    </div>
  );
}
