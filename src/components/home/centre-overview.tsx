"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shellFr } from "@/lib/i18n/shell";
import { cn } from "@/lib/utils";
import { setActiveCentreAction } from "@/server/actions/navigation";

const O = shellFr.home.overview;

export interface CentreOverviewItem {
  id: string;
  name: string;
  drafts: number;
  toSend: number;
  errors: number;
  month: number;
}

const COLUMNS = [
  { key: "drafts", label: O.drafts, short: O.short.drafts },
  { key: "toSend", label: O.toSend, short: O.short.toSend },
  { key: "errors", label: O.errors, short: O.short.errors },
  { key: "month", label: O.month, short: O.short.month },
] as const;

/* Grille commune à l'en-tête, aux lignes et au total : nom puis quatre colonnes de chiffres (desktop). */
const GRID = "grid grid-cols-4 gap-x-3 sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(5.5rem,7.5rem))] sm:items-center";

function Stat({ value, label, short, danger = false }: { value: number; label: string; short: string; danger?: boolean }) {
  return (
    <span className="flex flex-col sm:block sm:text-right">
      {/* Téléphone : libellé court visible ; lecteurs d'écran : libellé complet partout. */}
      <span aria-hidden className="text-meta whitespace-nowrap text-muted-foreground sm:hidden">
        {short}
      </span>
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          "text-sm tabular-nums",
          value === 0 ? "text-muted-foreground" : "font-medium text-foreground",
          danger && value > 0 && "text-destructive",
        )}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * Carte « Par centre » (accueil en vue « Tous les centres ») : une ligne par centre ;
 * un clic ouvre la vue de ce centre (centre actif).
 */
export function CentreOverview({ items }: { items: CentreOverviewItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(item: CentreOverviewItem) {
    if (pending) return;
    setPendingId(item.id);
    start(async () => {
      const res = await setActiveCentreAction(item.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(shellFr.sidebar.centreChanged(item.name));
      router.refresh();
    });
  }

  const totals = items.reduce(
    (t, i) => ({
      drafts: t.drafts + i.drafts,
      toSend: t.toSend + i.toSend,
      errors: t.errors + i.errors,
      month: t.month + i.month,
    }),
    { drafts: 0, toSend: 0, errors: 0, month: 0 },
  );

  return (
    <div data-testid="centre-overview">
      <div
        aria-hidden
        className={cn(GRID, "border-b px-4 py-2 text-meta font-medium text-muted-foreground max-sm:hidden sm:px-5")}
      >
        <span>{O.centre}</span>
        {COLUMNS.map((c) => (
          <span key={c.key} className="text-right">
            {c.label}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              title={O.open(item.name)}
              aria-busy={(pending && pendingId === item.id) || undefined}
              className={cn(
                GRID,
                "relative min-h-11 w-full gap-y-2 px-4 py-3 pr-10 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:ring-inset sm:px-5 sm:pr-10",
              )}
            >
              <span className="col-span-4 flex min-w-0 items-center gap-2 sm:col-span-1">
                <Building2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
              </span>
              {COLUMNS.map((c) => (
                <Stat key={c.key} value={item[c.key]} label={c.label} short={c.short} danger={c.key === "errors"} />
              ))}
              <span
                aria-hidden
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground [&_svg]:size-4"
              >
                {pending && pendingId === item.id ? <Loader2 className="animate-spin" /> : <ChevronRight />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className={cn(GRID, "gap-y-2 border-t bg-muted/40 px-4 py-3 pr-10 sm:px-5 sm:pr-10")}>
        <span className="col-span-4 text-sm font-medium sm:col-span-1">{O.totals}</span>
        {COLUMNS.map((c) => (
          <Stat key={c.key} value={totals[c.key]} label={c.label} short={c.short} danger={c.key === "errors"} />
        ))}
      </div>
    </div>
  );
}
