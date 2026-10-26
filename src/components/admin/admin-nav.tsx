"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { adminFr } from "@/lib/i18n/admin";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";
import { activeAdminSection, adminSectionLabel, groupAdminSections, isAdminSectionActive, type AdminSection } from "./admin-sections";

/**
 * Navigation de l'administration (cf. design §4.12).
 * Large (conteneur admin ≥ 56 rem) : sous-navigation verticale groupée, collante.
 * Étroit : un bouton « Section : … » ouvre un panneau bas avec les mêmes groupes.
 * La navigation large vient en premier dans le DOM (les tests visent le premier libellé visible).
 */
export function AdminNav({ demo }: { demo: boolean }) {
  const pathname = usePathname();
  const groups = groupAdminSections({ demo });
  return (
    <>
      <nav
        aria-label={fr.admin.nav.label}
        className="sticky top-20 hidden space-y-5 self-start @4xl/admin:block"
      >
        {groups.map((g) => (
          <div key={g.key} className="space-y-1">
            <p className="px-2.5 text-xs font-medium text-muted-foreground">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((s) => (
                <li key={s.key}>
                  <AdminNavLink section={s} active={isAdminSectionActive(s, pathname)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <AdminSectionSwitcher groups={groups} pathname={pathname} />
    </>
  );
}

function AdminNavLink({ section, active, onNavigate, large = false }: { section: AdminSection; active: boolean; onNavigate?: () => void; large?: boolean }) {
  const Icon = section.icon;
  return (
    <Link
      href={section.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group/nav flex items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        large ? "min-h-12 text-base sm:text-sm" : "h-9 pointer-coarse:min-h-11",
        active
          ? "bg-card font-medium text-foreground shadow-xs ring-1 ring-border dark:bg-popover"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", active ? "text-brand-fg" : "text-muted-foreground group-hover/nav:text-foreground")}
      />
      <span className="min-w-0 truncate">{adminSectionLabel(section.key)}</span>
    </Link>
  );
}

/** Sélecteur de section sous le seuil large : bouton pleine largeur + panneau bas groupé. */
function AdminSectionSwitcher({
  groups,
  pathname,
}: {
  groups: ReturnType<typeof groupAdminSections>;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const active = activeAdminSection(pathname, groups.flatMap((g) => g.items));
  const Icon = active.icon;
  const title = adminSectionLabel(active.key);
  return (
    <div className="@4xl/admin:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="lg" className="w-full justify-start px-3 text-sm font-medium">
            <Icon aria-hidden className="text-brand-fg" />
            <span className="sr-only">{adminFr.nav.current("")}</span>
            <span className="min-w-0 flex-1 truncate text-left">{title}</span>
            <ChevronsUpDown aria-hidden className="text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="gap-0">
          <SheetHeader className="px-4 pt-5 pb-2">
            <SheetTitle>{adminFr.nav.sheetTitle}</SheetTitle>
            <SheetDescription className="sr-only">{adminFr.nav.sheetDescription}</SheetDescription>
          </SheetHeader>
          <nav aria-label={fr.admin.nav.label} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
            {groups.map((g) => (
              <div key={g.key} className="space-y-1">
                <p className="px-2.5 pt-1 text-xs font-medium text-muted-foreground">{g.label}</p>
                <ul className="space-y-0.5">
                  {g.items.map((s) => (
                    <li key={s.key}>
                      <AdminNavLink section={s} active={s.key === active.key} onNavigate={() => setOpen(false)} large />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
