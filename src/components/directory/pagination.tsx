"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { dirFr } from "@/lib/i18n/directory";
import { pageRange } from "./utils";

const T = dirFr.pagination;

/** Pagination d'annuaire portée par l'URL (`?page=`) : « 51–100 sur 245 » + Précédent / Suivant. */
export function DirectoryPagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const { href } = useUrlFilters({ resetKeys: [] });
  const r = pageRange(page, pageSize, total);
  if (r.pages <= 1) return null;
  const to = (p: number) => href({ page: p > 1 ? String(p) : null });

  return (
    <nav aria-label={T.label} className="flex items-center justify-between gap-3">
      <p className="text-meta text-muted-foreground tabular-nums">{T.range(r.from, r.to, total)}</p>
      <div className="flex items-center gap-2">
        {r.hasPrevious ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={to(r.page - 1)}>
              <ChevronLeft aria-hidden /> {T.previous}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft aria-hidden /> {T.previous}
          </Button>
        )}
        {r.hasNext ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={to(r.page + 1)}>
              {T.next} <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {T.next} <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}
