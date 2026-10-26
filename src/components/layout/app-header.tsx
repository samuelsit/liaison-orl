"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";
import { cn } from "@/lib/utils";
import { isFocusedTaskPath } from "./mobile-tab-bar";

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}
const isScrolled = () => window.scrollY > 4;
const notScrolled = () => false;

/**
 * En-tête collant de l'application (56 px) : la bordure n'apparaît qu'une fois la page défilée.
 * Ordinateur : bouton du menu, recherche, outils. Téléphone : logo, outils, loupe.
 */
export function AppHeader({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(subscribeScroll, isScrolled, notScrolled);
  return (
    <header
      data-slot="app-header"
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-transparent bg-background/85 px-3 backdrop-blur-md transition-[border-color] duration-150 data-scrolled:border-border sm:px-4"
    >
      {children}
    </header>
  );
}

/**
 * Bouton du menu : masqué sur téléphone quand la barre d'onglets (bouton « Menu ») est affichée,
 * pour qu'un seul bouton « Afficher ou masquer le menu » soit visible. Sur les écrans outils
 * (éditeur, envoi), sans barre d'onglets, il reste visible.
 */
export function HeaderMenuTrigger() {
  const pathname = usePathname();
  return <SidebarTrigger aria-label={fr.nav.menuToggle} className={cn(!isFocusedTaskPath(pathname) && "max-md:hidden")} />;
}

/** Logo compact de l'en-tête mobile (lien vers l'accueil). */
export function HeaderBrand({ brand }: { brand: { name: string; logo: string | null } }) {
  return (
    <Link
      href="/"
      aria-label={shellFr.header.homeLink(brand.name)}
      className="flex min-h-11 min-w-0 items-center rounded-md md:hidden"
    >
      <span className={brand.logo ? "inline-flex dark:rounded-md dark:bg-white/95 dark:px-1.5 dark:py-0.5" : "inline-flex"}>
        <BrandLogo name={brand.name} logo={brand.logo} className="h-7 max-w-36 text-base" />
      </span>
    </Link>
  );
}
