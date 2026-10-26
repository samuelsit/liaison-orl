import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { shellFr } from "@/lib/i18n/shell";
import type { ServiceModes } from "@/lib/env";

/**
 * Pastille « Mode démo » de l'en-tête (administrateurs), affichée quand au moins un service
 * est simulé ; elle mène à l'état des services. Remplace l'ancien bandeau pleine largeur.
 */
export function DemoBanner({ modes }: { modes: ServiceModes }) {
  const mocked = (Object.keys(modes) as (keyof ServiceModes)[]).filter((k) => modes[k] === "mock");
  if (mocked.length === 0) return null;
  const services = mocked.map((k) => shellFr.header.demoServices[k]).join(", ");
  return (
    <Link
      href="/admin/services"
      title={shellFr.header.demoPillTitle(services)}
      className="relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-warning px-2.5 text-xs font-medium whitespace-nowrap text-warning-foreground ring-1 ring-warning-border/50 ring-inset transition-colors outline-none hover:bg-warning/70 focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2 pointer-coarse:after:inset-x-0"
    >
      <FlaskConical className="size-3.5" aria-hidden />
      {shellFr.header.demoPill}
      <span className="sr-only">{` : ${shellFr.header.demoPillTitle(services)}`}</span>
    </Link>
  );
}
