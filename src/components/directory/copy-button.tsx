"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/** Copie une valeur dans le presse-papiers (e-mail, téléphone, adresse) avec confirmation discrète. */
export async function copyToClipboard(value: string, message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
    return true;
  } catch {
    toast.error(dirFr.copyFailed);
    return false;
  }
}

/** Bouton icône « Copier » (infobulle, nom accessible explicite, coche pendant 1,5 s). */
export function CopyButton({
  value,
  label,
  message,
  className,
}: {
  value: string;
  /** Nom accessible : « Copier l'e-mail de Dr Sarah BENALI ». */
  label: string;
  /** Message de confirmation : « E-mail copié ». */
  message: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn("shrink-0 text-muted-foreground hover:text-foreground", className)}
          onClick={async () => setCopied(await copyToClipboard(value, message))}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? fr.common.copied : fr.common.copy}</TooltipContent>
    </Tooltip>
  );
}
