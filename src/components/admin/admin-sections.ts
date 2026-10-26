import {
  Activity,
  Archive,
  BookUser,
  Building2,
  ChartColumn,
  FileText,
  Inbox,
  LayoutDashboard,
  Palette,
  ScrollText,
  SendHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { adminFr } from "@/lib/i18n/admin";
import { fr } from "@/lib/i18n/fr";

export type AdminSectionKey = keyof typeof fr.admin.nav.items;
export type AdminGroupKey = keyof typeof fr.admin.nav.groups;

export interface AdminSection {
  key: AdminSectionKey;
  href: string;
  group: AdminGroupKey;
  icon: LucideIcon;
  /** Visible seulement quand l'e-mail fonctionne en mode démo. */
  demoOnly?: boolean;
}

/**
 * Sections de l'administration, dans l'ordre de la navigation (cf. design §4.12).
 * Source unique pour la sous-navigation, le sélecteur mobile et les en-têtes de page
 * (réutilisable par la palette de commandes).
 */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: "overview", href: "/admin", group: "organisation", icon: LayoutDashboard },
  { key: "brand", href: "/admin/marque", group: "organisation", icon: Palette },
  { key: "centres", href: "/admin/centres", group: "organisation", icon: Building2 },
  { key: "users", href: "/admin/utilisateurs", group: "organisation", icon: Users },
  { key: "directory", href: "/admin/annuaire", group: "contents", icon: BookUser },
  { key: "templates", href: "/admin/modeles", group: "contents", icon: FileText },
  { key: "dispatch", href: "/admin/envois", group: "dispatch", icon: SendHorizontal },
  { key: "demoOutbox", href: "/admin/boite-demo", group: "dispatch", icon: Inbox, demoOnly: true },
  { key: "statistics", href: "/admin/statistiques", group: "monitoring", icon: ChartColumn },
  { key: "audit", href: "/admin/audit", group: "monitoring", icon: ScrollText },
  { key: "retention", href: "/admin/conservation", group: "system", icon: Archive },
  { key: "services", href: "/admin/services", group: "system", icon: Activity },
];

const GROUP_ORDER: readonly AdminGroupKey[] = ["organisation", "contents", "dispatch", "monitoring", "system"];

/** Libellé court (navigation) d'une section. */
export function adminSectionLabel(key: AdminSectionKey): string {
  return fr.admin.nav.items[key];
}

/** Titre et description de page d'une section. */
export function adminSectionMeta(key: AdminSectionKey): { title: string; description: string } {
  return adminFr.sections[key];
}

/** Vrai si `pathname` appartient à la section (la vue d'ensemble n'est active que sur /admin). */
export function isAdminSectionActive(section: Pick<AdminSection, "href">, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (section.href === "/admin") return path === "/admin";
  return path === section.href || path.startsWith(`${section.href}/`);
}

/** Section correspondant à l'URL courante (vue d'ensemble par défaut). */
export function activeAdminSection(pathname: string, sections: readonly AdminSection[] = ADMIN_SECTIONS): AdminSection {
  return sections.find((s) => isAdminSectionActive(s, pathname)) ?? sections[0]!;
}

/** Sections visibles regroupées dans l'ordre de la navigation. */
export function groupAdminSections({ demo }: { demo: boolean }): { key: AdminGroupKey; label: string; items: AdminSection[] }[] {
  const visible = ADMIN_SECTIONS.filter((s) => demo || !s.demoOnly);
  return GROUP_ORDER.map((key) => ({ key, label: fr.admin.nav.groups[key], items: visible.filter((s) => s.group === key) })).filter(
    (g) => g.items.length > 0,
  );
}
