import { Badge, type BadgeTone } from "@/components/ui/badge";
import { fr } from "@/lib/i18n/fr";
import type { DocumentStatus } from "@/lib/schemas/document";
import type { DispatchStatus } from "@/lib/schemas/dispatch";

/*
 * Pastilles de statut (cf. design §5) : tons sémantiques, jamais la couleur de marque
 * (« Validé » = info). Point + libellé : le sens ne repose jamais sur la couleur seule.
 */

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  BROUILLON: "neutral",
  VALIDE: "info",
  ENVOYE: "success",
  ERREUR: "danger",
};

export function DocumentStatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  return (
    <Badge tone={DOCUMENT_STATUS_TONE[status]} dot data-status={status} className={className}>
      {fr.documentStatus[status]}
    </Badge>
  );
}

export const DISPATCH_STATUS_TONE: Record<DispatchStatus, BadgeTone> = {
  queued: "neutral",
  awaiting_confirmation: "warning",
  sent: "info",
  printing: "info",
  delivered: "success",
  opened: "success",
  posted: "success",
  action_required: "danger",
  bounced: "danger",
  undeliverable: "danger",
  failed: "danger",
  cancelled: "neutral",
};

/** Envois en cours d'acheminement : le point pulse (animation neutralisée si réduite). */
const IN_PROGRESS: ReadonlySet<DispatchStatus> = new Set(["sent", "printing"]);

export function DispatchStatusBadge({ status, className }: { status: DispatchStatus; className?: string }) {
  return (
    <Badge
      tone={DISPATCH_STATUS_TONE[status]}
      dot={IN_PROGRESS.has(status) ? "pulse" : true}
      data-status={status}
      className={className}
    >
      {fr.dispatchStatus[status]}
    </Badge>
  );
}
