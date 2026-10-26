import { CircleCheck, CircleDashed, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import type { PreferredChannel } from "@/lib/schemas/prescriber";
import { cn } from "@/lib/utils";
import type { ChannelReadiness } from "./format";

const R = dirFr.prescribers.readiness;

function Line({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CircleCheck : CircleDashed;
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok ? "text-success-foreground" : "text-muted-foreground")} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/**
 * État d'envoi en direct d'une fiche prescripteur : e-mail prêt ou manquant, courrier prêt
 * ou adresse incomplète. Si le canal préféré est inutilisable, le bloc passe en alerte et
 * propose de basculer en un clic sur le canal disponible.
 */
export function SendReadiness({
  readiness,
  onSwitch,
  className,
}: {
  readiness: ChannelReadiness;
  onSwitch?: (channel: PreferredChannel) => void;
  className?: string;
}) {
  const warn = !readiness.preferredUsable;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "space-y-2 rounded-lg border p-3 text-meta",
        warn ? "border-warning-border bg-warning text-warning-foreground" : "bg-surface-subtle text-foreground",
        className,
      )}
    >
      {warn ? (
        <p className="flex items-start gap-2 font-medium">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {R.unusable}
        </p>
      ) : null}
      <ul className={cn("space-y-1", warn && "[&_svg]:text-current!")}>
        <Line ok={readiness.email}>{readiness.email ? R.emailReady : R.emailMissing}</Line>
        <Line ok={readiness.post}>{readiness.post ? R.postReady : R.postMissing}</Line>
      </ul>
      {warn && readiness.suggestion && onSwitch ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onSwitch(readiness.suggestion!)}>
          {R.switchTo(fr.preferredChannel[readiness.suggestion])}
        </Button>
      ) : null}
    </div>
  );
}
