"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { adminFr } from "@/lib/i18n/admin";

/** Bouton icône « Copier » : presse-papiers, confirmation par toast et coche pendant 2 s. */
export function CopyButton({ value, label = adminFr.services.copy, done = adminFr.services.copied }: { value: string; label?: string; done?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
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
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              toast.success(done);
            } catch {
              toast.error(adminFr.services.copyFailed);
            }
          }}
        >
          {copied ? <Check aria-hidden className="text-success-foreground" /> : <Copy aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
