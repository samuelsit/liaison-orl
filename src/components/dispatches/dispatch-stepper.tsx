import { Ban, Check, TriangleAlert } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { fr } from "@/lib/i18n/fr";
import { dispFr } from "@/lib/i18n/dispatch";
import type { Channel } from "@/lib/schemas/dispatch";
import { cn } from "@/lib/utils";
import type { DispatchStep, StepKey } from "./dispatch-steps";

function stepLabel(channel: Channel, step: DispatchStep): string {
  if (step.status && (step.state === "error" || step.state === "cancelled")) return fr.dispatchStatus[step.status];
  const labels: Record<string, string> = dispFr.stepper[channel];
  return labels[step.key as StepKey] ?? step.key;
}

/**
 * Étapes d'un envoi (Créé → Accepté → Délivré → Consulté, ou Créé → Transmis → En impression
 * → Remis à La Poste). Liste ordonnée : horizontale ≥ sm, verticale sur mobile. Le sens ne
 * repose jamais sur la couleur seule (icônes, libellé d'état pour les lecteurs d'écran).
 */
export function DispatchStepper({ channel, steps, className }: { channel: Channel; steps: DispatchStep[]; className?: string }) {
  const S = dispFr.stepper;
  return (
    <ol aria-label={S.label} className={cn("grid gap-0 sm:grid-cols-4", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const reached = step.state === "done" || step.state === "current";
        const nextReached = !last && (steps[i + 1]!.state === "done" || steps[i + 1]!.state === "current");
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:gap-2 sm:pr-4 sm:pb-0"
          >
            {/* Connecteur vers l'étape suivante : vertical sur mobile, horizontal ≥ sm. */}
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 bottom-0 left-3.5 w-0.5 -translate-x-1/2 rounded-full sm:top-3.5 sm:right-0 sm:bottom-auto sm:left-8 sm:h-0.5 sm:w-auto sm:translate-x-0 sm:-translate-y-1/2",
                  nextReached ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums [&_svg]:size-3.5",
                step.state === "done" && "bg-primary text-primary-foreground",
                step.state === "current" && "border-2 border-primary bg-card text-brand-fg ring-4 ring-primary/15",
                step.state === "upcoming" && "border border-dashed border-muted-foreground/60 bg-card text-muted-foreground",
                step.state === "error" && "bg-destructive-fill text-white",
                step.state === "cancelled" && "bg-muted text-muted-foreground ring-1 ring-border",
              )}
            >
              {step.state === "done" ? <Check /> : step.state === "error" ? <TriangleAlert /> : step.state === "cancelled" ? <Ban /> : i + 1}
            </span>
            <span className="min-w-0 pt-1 sm:pt-0">
              <span
                className={cn(
                  "block text-sm font-medium",
                  step.state === "upcoming" && "text-muted-foreground",
                  step.state === "error" && "text-destructive",
                )}
              >
                {stepLabel(channel, step)}
                <span className="sr-only">
                  {" "}
                  ({step.state === "done" ? S.done : step.state === "current" ? S.current : step.state === "upcoming" ? S.waiting : fr.dispatchStatus[step.status ?? "failed"]})
                </span>
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {step.at ? formatDateTime(step.at) : step.state === "upcoming" ? S.waiting : reached ? "—" : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
