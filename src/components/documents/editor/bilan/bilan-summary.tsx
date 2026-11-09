"use client";

import { CheckCircle2, CircleAlert, PencilLine, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AudiogramChart } from "@/components/audiology/audiogram-chart";
import { AudiometryResults } from "@/components/audiology/audiometry-results";
import { listLowConfidence } from "@/components/audiology/measure-cells";
import { countAllMeasures } from "@/lib/audiology/calculations";
import { earSeries } from "@/lib/audiology/chart";
import type { Audiometry } from "@/lib/schemas/audiometry";
import { crFr } from "@/lib/i18n/compte-rendu";
import { cn } from "@/lib/utils";

const B = crFr.bilan;

/**
 * Synthèse du bilan fusionné dans le formulaire : état (à vérifier / confirmé), nombre
 * de fichiers et de conflits, audiogramme OD + OG et chiffres clés. La vérification
 * détaillée s'ouvre en plein écran.
 */
export function BilanSummary({
  audiometry,
  confirmed,
  wasConfirmed,
  readOnly,
  fileCount,
  conflicts,
  commentPending,
  onOpenReview,
}: {
  audiometry: Audiometry;
  confirmed: boolean;
  /** Les fichiers ont changé après une confirmation : les mesures sont à revérifier. */
  wasConfirmed: boolean;
  readOnly: boolean;
  fileCount: number;
  conflicts: number;
  commentPending: boolean;
  onOpenReview: () => void;
}) {
  const count = countAllMeasures(audiometry);
  const low = listLowConfidence(audiometry).length;

  const status = confirmed ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-foreground">
      <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {B.statusConfirmed}
    </span>
  ) : count === 0 ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <PencilLine className="size-4 shrink-0" aria-hidden /> {B.statusManual}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning-foreground">
      <CircleAlert className="size-4 shrink-0" aria-hidden /> {wasConfirmed ? B.statusReconfirm : low > 0 ? B.statusToCheckCount(low) : B.statusToCheck}
    </span>
  );

  const action = readOnly ? (
    count > 0 ? (
      <Button type="button" variant="outline" size="sm" onClick={onOpenReview}>
        <ScanSearch aria-hidden /> {B.viewMeasures}
      </Button>
    ) : null
  ) : confirmed ? (
    <Button type="button" variant="outline" size="sm" onClick={onOpenReview}>
      <PencilLine aria-hidden /> {B.editMeasures}
    </Button>
  ) : (
    <Button type="button" size="sm" onClick={onOpenReview} data-testid="review-measures">
      <ScanSearch aria-hidden /> {count === 0 ? B.enterMeasures : B.reviewMeasures}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {status}
        <span className="text-meta text-muted-foreground tabular-nums">
          {B.measuresCount(count)}
          {fileCount > 0 ? ` · ${B.filesCount(fileCount)}` : ""}
        </span>
        {conflicts > 0 ? <span className="text-meta font-medium text-warning-foreground tabular-nums">{B.conflictsCount(conflicts)}</span> : null}
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>

      {commentPending ? (
        <p className="flex items-center gap-2 text-meta text-muted-foreground" aria-live="polite">
          <Spinner className="size-3.5" aria-hidden /> {B.commentWriting}
        </p>
      ) : null}

      {count > 0 ? (
        <div className={cn("grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]")}>
          <AudiogramChart
            size="sm"
            showTitle={false}
            title={crFr.chart.titles.combined}
            series={[...earSeries(audiometry, "right"), ...earSeries(audiometry, "left")]}
            onPointClick={onOpenReview}
          />
          <AudiometryResults value={audiometry} variant="compact" />
        </div>
      ) : null}
    </div>
  );
}
