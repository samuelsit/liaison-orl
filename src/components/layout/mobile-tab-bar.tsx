"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FileText, House, Loader2, Menu, Plus, Send, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";
import { cn } from "@/lib/utils";
import { CreateSheet } from "./create-sheet";

const T = shellFr.tabBar;

/** Écrans outils (éditeur, récapitulatif d'envoi) : ils ont leur propre barre d'action en bas. */
export function isFocusedTaskPath(pathname: string): boolean {
  return /^\/documents\/[^/]+(\/.*)?$/.test(pathname);
}

/**
 * Barre d'onglets mobile (< md, cf. design §8) : Accueil, Documents, « Nouveau » (feuille Créer),
 * Envois, Menu (ouvre la barre latérale : centre, annuaire, patients, compte…).
 * Porte `data-slot="mobile-tab-bar"` : les barres flottantes se placent au-dessus.
 */
export function MobileTabBar({ counts }: { counts: { drafts: number; errors: number } }) {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const [createOpen, setCreateOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Changement de page (éditeur ouvert, lien suivi) : la feuille « Créer » se referme.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setCreateOpen(false);
  }

  if (isFocusedTaskPath(pathname)) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <nav
        data-slot="mobile-tab-bar"
        aria-label={T.label}
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          <li>
            <TabLink href="/" label={T.home} icon={House} active={isActive("/")} />
          </li>
          <li>
            <TabLink
              href="/documents"
              label={T.documents}
              icon={FileText}
              active={isActive("/documents")}
              badge={counts.drafts > 0 ? { count: counts.drafts, label: shellFr.sidebar.draftsBadge(counts.drafts), tone: "neutral" } : null}
            />
          </li>
          <li>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={createOpen}
              aria-label={T.createLabel}
              className={tabClass}
            >
              <span
                aria-hidden
                className="flex h-8 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-active/tab:scale-95"
              >
                <Plus className="size-5" />
              </span>
              <span aria-hidden>{T.create}</span>
            </button>
          </li>
          <li>
            <TabLink
              href="/envois"
              label={T.dispatches}
              icon={Send}
              active={isActive("/envois")}
              badge={counts.errors > 0 ? { count: counts.errors, label: shellFr.sidebar.errorsBadge(counts.errors), tone: "danger" } : null}
            />
          </li>
          <li>
            {/* Seul bouton « Afficher ou masquer le menu » visible sur téléphone (le déclencheur de l'en-tête est masqué). */}
            <button
              type="button"
              onClick={() => setOpenMobile(!openMobile)}
              aria-label={fr.nav.menuToggle}
              aria-expanded={openMobile}
              className={tabClass}
            >
              <span aria-hidden className="flex h-8 items-center justify-center">
                <Menu className="size-5" />
              </span>
              <span aria-hidden>{T.menu}</span>
            </button>
          </li>
        </ul>
      </nav>
      <CreateSheet open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

const tabClass = cn(
  "group/tab relative flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 text-2xs font-medium text-muted-foreground outline-none select-none",
  "transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset",
  "aria-[current=page]:text-foreground [-webkit-tap-highlight-color:transparent]",
);

interface TabBadge {
  count: number;
  label: string;
  tone: "neutral" | "danger";
}

function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 aria-hidden className="size-5 animate-spin text-brand-fg" />;
  return <Icon aria-hidden className={cn("size-5", active && "text-brand-fg")} />;
}

function TabLink({
  href,
  label,
  icon,
  active,
  badge = null,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: TabBadge | null;
}) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass}>
      <span className="relative flex h-8 items-center justify-center">
        <TabIcon icon={icon} active={active} />
        {badge ? (
          <span
            aria-hidden
            className={cn(
              "absolute top-0 left-3.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums ring-2 ring-background",
              badge.tone === "danger" ? "bg-destructive-fill text-white" : "bg-muted text-foreground",
            )}
          >
            {badge.count > 99 ? "99+" : badge.count}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
      {badge ? <span className="sr-only">{`, ${badge.label}`}</span> : null}
    </Link>
  );
}
