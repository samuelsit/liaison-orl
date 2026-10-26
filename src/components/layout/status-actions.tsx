"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ArrowLeft, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/layout/command-palette";
import { shellFr } from "@/lib/i18n/shell";

const noopSubscribe = () => () => {};

/** « Page précédente » : masqué quand l'onglet n'a pas d'historique (lien ouvert directement). */
export function BackButton() {
  const router = useRouter();
  const hasHistory = useSyncExternalStore(
    noopSubscribe,
    () => window.history.length > 1,
    () => false,
  );
  if (!hasHistory) return null;
  return (
    <Button variant="outline" onClick={() => router.back()}>
      <ArrowLeft aria-hidden /> {shellFr.errors.goBack}
    </Button>
  );
}

/** Ouvre la palette de recherche (dans la coquille de l'application uniquement). */
export function OpenSearchButton() {
  const { open } = useCommandPalette();
  return (
    <Button variant="outline" onClick={open}>
      <Search aria-hidden /> {shellFr.errors.search}
    </Button>
  );
}

/** Copie la référence technique d'une erreur pour la transmettre au support. */
export function CopyReferenceButton({ reference }: { reference: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      toast.success(shellFr.errors.refCopied);
    } catch {
      toast.error(shellFr.errors.reference(reference));
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={copy} className="text-muted-foreground">
      <Copy aria-hidden />
      <span className="font-mono text-xs">{shellFr.errors.reference(reference)}</span>
      <span className="sr-only">{` (${shellFr.errors.copyRef})`}</span>
    </Button>
  );
}
