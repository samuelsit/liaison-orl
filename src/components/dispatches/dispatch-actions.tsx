"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acknowledgeDispatchAction, cancelDispatchAction, retryDispatchAction } from "@/server/actions/dispatch";

export function DispatchActions({ id, canRetry, canCancel, canAcknowledge }: { id: string; canRetry: boolean; canCancel: boolean; canAcknowledge: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {canRetry ? (
        <Button
          disabled={pending}
          data-testid="retry-dispatch"
          onClick={() =>
            start(async () => {
              const res = await retryDispatchAction(id);
              if (!res.ok) return void toast.error(res.error);
              const d = res.data[0];
              if (d?.error) toast.error(d.error);
              else toast.success("Nouvel envoi effectué.");
              if (d) router.push(`/envois/${d.id}`);
            })
          }
        >
          <RotateCcw aria-hidden /> Renvoyer
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelDispatchAction(id);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message ?? "Annulé.");
              router.refresh();
            })
          }
        >
          <Ban aria-hidden /> Annuler le courrier
        </Button>
      ) : null}
      {canAcknowledge ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await acknowledgeDispatchAction(id);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Erreur masquée.", {
                action: { label: "Annuler", onClick: () => router.refresh() },
              });
              router.refresh();
            })
          }
        >
          <EyeOff aria-hidden /> Masquer l&apos;erreur
        </Button>
      ) : null}
    </div>
  );
}
