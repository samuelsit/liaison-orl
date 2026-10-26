"use client";

import { useState, useTransition } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dirFr } from "@/lib/i18n/directory";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "@/server/actions/prescribers";

const T = dirFr.prescribers;

/**
 * Étoile « favori » (annuaire, fiche) : bouton bascule optimiste, sans toast de succès.
 * Le changement est annoncé aux lecteurs d'écran ; l'étoile rebondit brièvement
 * (désactivé si l'utilisateur réduit les animations). Annulation et message en cas d'échec.
 */
export function FavoriteToggle({ id, favorite, name, className }: { id: string; favorite: boolean; name: string; className?: string }) {
  const [value, setValue] = useState(favorite);
  const [synced, setSynced] = useState(favorite);
  const [announce, setAnnounce] = useState("");
  const [, startTransition] = useTransition();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reduceMotion = useReducedMotion();

  // La liste rafraîchie par le serveur fait foi.
  if (favorite !== synced) {
    setSynced(favorite);
    setValue(favorite);
  }

  function toggle() {
    const next = !value;
    setValue(next);
    if (!reduceMotion && scope.current) void animate(scope.current, { scale: [1, 1.3, 1] }, { duration: 0.25 });
    startTransition(async () => {
      const res = await toggleFavoriteAction(id);
      if (!res.ok) {
        setValue(!next);
        toast.error(res.error);
        return;
      }
      setValue(res.data.favorite);
      setAnnounce(res.data.favorite ? T.favoriteAdded : T.favoriteRemoved);
    });
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-pressed={value}
            aria-label={T.favoriteToggle(name)}
            onClick={toggle}
            className={cn("shrink-0", className)}
          >
            <span ref={scope} className="inline-flex">
              <Star
                aria-hidden
                className={cn("size-4 transition-colors", value ? "fill-brand-accent text-brand-accent" : "text-muted-foreground")}
              />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{value ? T.unfavorite : T.favorite}</TooltipContent>
      </Tooltip>
      <span role="status" className="sr-only">
        {announce}
      </span>
    </>
  );
}
