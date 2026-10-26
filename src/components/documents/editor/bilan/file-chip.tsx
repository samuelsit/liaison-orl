import { FileImage, FileText } from "lucide-react";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";

/** Pastille de fichier : icône, nom tronqué, taille. */
export function FileChip({ name, size, mimeType, className }: { name: string; size: number; mimeType: string; className?: string }) {
  const Icon = mimeType === "application/pdf" ? FileText : FileImage;
  return (
    <span title={name} className={cn("inline-flex h-7 max-w-64 min-w-0 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-muted-foreground", className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate font-medium text-foreground">{name}</span>
      <span className="shrink-0 tabular-nums">{crFr.bilan.fileSize(size)}</span>
    </span>
  );
}
