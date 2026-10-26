"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { dispFr, formatEuros } from "@/lib/i18n/dispatch";
import type { Channel } from "@/lib/schemas/dispatch";
import { retryDispatchAction, type SentSummary } from "@/server/actions/dispatch";

/** Ce qu'il faut savoir d'un envoi pour confirmer son renvoi. */
export interface ResendTarget {
  id: string;
  channel: Channel;
  recipientName: string;
  recipientEmail?: string | null;
  recipientAddress?: string | null;
  costCents?: number | null;
  currency?: string | null;
}

/**
 * Confirmation d'un renvoi : un e-mail repart vers le même destinataire ; un courrier
 * est une nouvelle lettre payante, d'où l'adresse et le coût indicatif rappelés.
 * Le renvoi passe par l'action existante (retryDispatch : même droit, nouvelle tentative).
 */
export function ResendDialog({
  target,
  open,
  onOpenChange,
  onDone,
  navigate = true,
}: {
  target: ResendTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé avec le nouvel envoi (panneau de succès) ; sinon la page est actualisée. */
  onDone?: (sent: SentSummary) => void;
  /** Ouvre la fiche de suivi du nouvel envoi. */
  navigate?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!target) return null;
  const postal = target.channel === "COURRIER";
  const T = dispFr.confirm;

  function confirm() {
    if (!target) return;
    start(async () => {
      const res = await retryDispatchAction(target.id);
      if (!res.ok) return void toast.error(res.error);
      const sent = res.data[0];
      if (sent?.error) toast.error(sent.error);
      else toast.success(T.resent);
      onOpenChange(false);
      if (sent) onDone?.(sent);
      if (sent && navigate) router.push(`/envois/${sent.id}`);
      else router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{postal ? T.resendPostalTitle : T.resendEmailTitle(target.recipientName)}</AlertDialogTitle>
          <AlertDialogDescription>
            {postal ? T.resendPostalDescription(target.recipientAddress ?? null) : T.resendEmailDescription(target.recipientEmail ?? null)}
            {postal && typeof target.costCents === "number" ? (
              <>
                {" "}
                {T.resendPostalCost(formatEuros(target.costCents, target.currency ?? "EUR"))}
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{fr.common.cancel}</AlertDialogCancel>
          {/* Bouton simple (et non AlertDialogAction) : la fenêtre reste ouverte pendant l'envoi. */}
          <Button onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
            {postal ? T.resendPostalAction : T.resendEmailAction}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
