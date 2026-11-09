"use client";

import { Camera, CircleAlert, ExternalLink, FileImage, FileText, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { countAllMeasures } from "@/lib/audiology/calculations";
import { bilanKind } from "@/lib/audiology/merge";
import { BILAN_CONDITIONS, type BilanCondition } from "@/lib/schemas/audiometry";
import type { AttachmentView } from "@/lib/schemas/attachment";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";

const B = crFr.bilan;

/** Nature lisible d'un fichier d'après sa lecture et son interprétation. */
export function fileKindLabel(a: AttachmentView): { label: string; tone: "neutral" | "warning" | "muted" } {
  if (a.extractionStatus === "pending") return { label: B.kinds.pending, tone: "muted" };
  if (a.extractionStatus === "failed") return { label: B.kinds.failed, tone: "warning" };
  const kind = bilanKind(a.extraction, a.condition, a.aidedSheet);
  return { label: B.kinds[kind], tone: kind === "vide" ? "warning" : "neutral" };
}

/**
 * Fichiers du bilan : nom, nature lue (tonale, vocale, avec appareils…), nombre de
 * mesures, interprétation ; menu par fichier (ouvrir, interpréter, relire, retirer).
 */
export function BilanFileList({
  files,
  readOnly,
  busy,
  canAdd,
  onAdd,
  onAddPhoto,
  onSetCondition,
  onReread,
  onRemove,
  className,
}: {
  files: AttachmentView[];
  readOnly: boolean;
  busy: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onAddPhoto: () => void;
  onSetCondition: (file: AttachmentView, condition: BilanCondition) => void;
  onReread: (file: AttachmentView) => void;
  onRemove: (file: AttachmentView) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card" aria-label={B.filesCount(files.length)}>
        {files.map((f) => {
          const Icon = f.mimeType === "application/pdf" ? FileText : FileImage;
          const kind = fileKindLabel(f);
          const measures = f.extraction ? countAllMeasures(f.extraction) : 0;
          return (
            <li key={f.id} className="flex min-w-0 items-center gap-3 px-3 py-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={f.fileName}>
                  {f.fileName}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-muted-foreground">
                  <span className={cn("inline-flex items-center gap-1", kind.tone === "warning" && "text-warning-foreground")}>
                    {kind.tone === "warning" ? <CircleAlert className="size-3.5" aria-hidden /> : null}
                    {kind.label}
                  </span>
                  {measures > 0 ? <span className="tabular-nums">· {B.readResult(measures)}</span> : null}
                  {f.condition !== "auto" ? <Badge tone="info">{B.condition[f.condition]}</Badge> : f.aidedSheet ? <span title={B.aidedSheetHint}>· {B.kinds.appareillee}</span> : null}
                  <span className="tabular-nums">· {B.fileSize(f.size)}</span>
                </p>
                {f.extractionStatus === "failed" && f.extractionError ? <p className="mt-0.5 text-meta text-warning-foreground">{f.extractionError}</p> : null}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={B.fileActions(f.fileName)} disabled={busy}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-64">
                  <DropdownMenuItem asChild>
                    <a href={`/api/pieces-jointes/${f.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden /> {B.openOriginal}
                    </a>
                  </DropdownMenuItem>
                  {!readOnly ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{B.interpret}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={f.condition} onValueChange={(v) => onSetCondition(f, v as BilanCondition)}>
                        {BILAN_CONDITIONS.map((c) => (
                          <DropdownMenuRadioItem key={c} value={c} disabled={f.extractionStatus !== "done" && f.extractionStatus !== "manual"}>
                            {B.condition[c]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onReread(f)}>
                        <RotateCcw aria-hidden /> {B.reread}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => onRemove(f)}>
                        <Trash2 aria-hidden /> {B.remove}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>
      {!readOnly && canAdd ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={busy} data-testid="bilan-add-file">
            <Plus aria-hidden /> {B.addFile}
          </Button>
          <Button type="button" variant="outline" size="sm" className="sm:hidden" onClick={onAddPhoto} disabled={busy}>
            <Camera aria-hidden /> {B.addPhoto}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
