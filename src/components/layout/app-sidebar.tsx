"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  House,
  Keyboard,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  Plus,
  Send,
  Settings,
  Stethoscope,
  Sun,
  SunMoon,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";
import { cn } from "@/lib/utils";
import { setActiveCentreAction } from "@/server/actions/navigation";
import { useCreateDocument } from "@/hooks/use-create-document";
import { BrandLogo } from "@/components/brand/brand-logo";
import { NAV_SEQUENCES, useCommandPalette } from "@/components/layout/command-palette";
import { KeySequence } from "@/components/layout/key-hints";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Shortcut } from "@/components/ui/shortcut";
import type { Role } from "@/lib/schemas/common";

const S = shellFr.sidebar;

export interface SidebarProps {
  brand: { name: string; logo: string | null };
  centres: { id: string; name: string }[];
  activeCentreId: string;
  user: { fullName: string; email: string; role: Role; initials: string };
  /** Brouillons du centre actif (même règle que « À finir » de l'accueil) et erreurs d'envoi non traitées. */
  counts: { drafts: number; errors: number };
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  seq?: readonly string[];
}

const MAIN_NAV: NavItem[] = [
  { href: "/", label: fr.nav.home, icon: House, exact: true, seq: NAV_SEQUENCES["/"] },
  { href: "/documents", label: fr.nav.documents, icon: FileText, seq: NAV_SEQUENCES["/documents"] },
  { href: "/envois", label: fr.nav.dispatches, icon: Send, seq: NAV_SEQUENCES["/envois"] },
];

const DIRECTORY_NAV: NavItem[] = [
  { href: "/patients", label: fr.nav.patients, icon: Users, seq: NAV_SEQUENCES["/patients"] },
  { href: "/prescripteurs", label: fr.nav.prescribers, icon: Stethoscope, seq: NAV_SEQUENCES["/prescripteurs"] },
];

const ADMIN_NAV: NavItem[] = [{ href: "/admin", label: fr.nav.admin, icon: Settings, seq: ["g", "a"] }];

export function AppSidebar({ brand, centres, activeCentreId, user, counts }: SidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const closeMobile = () => setOpenMobile(false);

  const badgeFor = (href: string): NavBadge | null => {
    if (href === "/documents" && counts.drafts > 0) return { count: counts.drafts, label: S.draftsBadge(counts.drafts), tone: "neutral" };
    if (href === "/envois" && counts.errors > 0) return { count: counts.errors, label: S.errorsBadge(counts.errors), tone: "danger" };
    return null;
  };

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink key={item.href} item={item} active={isActive(item)} badge={badgeFor(item.href)} onNavigate={closeMobile} />
    ));

  return (
    <Sidebar collapsible="icon">
      {/* `contents` : le repère de navigation n'altère pas la mise en page flex de la barre latérale. */}
      <nav aria-label={S.mainNav} className="contents">
        <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:px-2">
          <BrandHomeLink brand={brand} onNavigate={closeMobile} />
          <SidebarMenu className="gap-2">
            <CentreSwitcher centres={centres} activeCentreId={activeCentreId} />
            {isMobile ? null : <NewDocumentMenu />}
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">{renderItems(MAIN_NAV)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>{S.groupDirectories}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">{renderItems(DIRECTORY_NAV)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {user.role === "admin" ? (
            <SidebarGroup>
              <SidebarGroupLabel>{S.groupOrganisation}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">{renderItems(ADMIN_NAV)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>
        <SidebarFooter>
          <UserMenu user={user} />
        </SidebarFooter>
      </nav>
      <SidebarRail />
    </Sidebar>
  );
}

/* ---------- Logo ---------- */

function BrandHomeLink({ brand, onNavigate }: { brand: SidebarProps["brand"]; onNavigate: () => void }) {
  const label = shellFr.header.homeLink(brand.name);
  const monogram = brand.name.trim().charAt(0).toUpperCase() || "·";
  return (
    <>
      <Link
        href="/"
        onClick={onNavigate}
        aria-label={label}
        className="flex h-10 items-center rounded-md px-1.5 group-data-[collapsible=icon]:hidden"
      >
        {/* En sombre, le logo garde une plaquette claire autour de lui seul (le logo reste « papier »). */}
        <span className={brand.logo ? "inline-flex dark:rounded-md dark:bg-white/95 dark:px-2 dark:py-1" : "inline-flex"}>
          <BrandLogo name={brand.name} logo={brand.logo} className="h-8" />
        </span>
      </Link>
      <Link
        href="/"
        onClick={onNavigate}
        aria-label={label}
        title={brand.name}
        className="hidden size-9 items-center justify-center rounded-lg bg-primary font-heading text-base font-bold text-primary-foreground shadow-xs group-data-[collapsible=icon]:flex"
      >
        <span aria-hidden>{monogram}</span>
      </Link>
    </>
  );
}

/* ---------- Centre actif ---------- */

function CentreSwitcher({ centres, activeCentreId }: { centres: SidebarProps["centres"]; activeCentreId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [optimisticId, setOptimisticId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shownId = pending && optimisticId ? optimisticId : activeCentreId;
  const active = centres.find((c) => c.id === shownId) ?? centres[0];

  function changeCentre(id: string) {
    setOpen(false);
    if (id === activeCentreId) return;
    setOptimisticId(id);
    startTransition(async () => {
      const res = await setActiveCentreAction(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(S.centreChanged(centres.find((c) => c.id === id)?.name ?? ""));
        router.refresh();
      }
    });
  }

  const body = (
    <>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground [&_svg]:size-4"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Building2 />}
      </span>
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-xs text-muted-foreground">{S.activeCentre}</span>
        <span className="truncate text-sm font-medium">{active?.name}</span>
      </span>
    </>
  );

  if (centres.length <= 1) {
    return (
      <SidebarMenuItem>
        <div
          data-testid="centre-select"
          title={S.centreTooltip(active?.name ?? "")}
          className="flex h-12 items-center gap-2.5 rounded-lg px-1.5 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0.5 group-data-[collapsible=icon]:[&>*:not(:first-child)]:sr-only"
        >
          {body}
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <SidebarMenuButton
            size="lg"
            data-testid="centre-select"
            tooltip={S.centreTooltip(active?.name ?? "")}
            aria-busy={pending || undefined}
            className="px-1.5 data-[state=open]:bg-sidebar-accent"
          >
            {body}
            <ChevronsUpDown className="ml-auto text-muted-foreground" aria-hidden />
          </SidebarMenuButton>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" className="w-72 p-0">
          <Command>
            {centres.length > 6 ? <CommandInput placeholder={S.searchCentre} /> : null}
            <CommandList>
              <CommandEmpty>{S.noCentre}</CommandEmpty>
              <CommandGroup heading={S.centresList}>
                {centres.map((c) => (
                  <CommandItem key={c.id} value={c.name} data-checked={c.id === shownId} onSelect={() => changeCentre(c.id)}>
                    <Building2 aria-hidden className="text-muted-foreground" />
                    <span className="flex-1 truncate">{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}

/* ---------- « Nouveau document » ---------- */

function NewDocumentMenu() {
  const { create, pending, pendingType } = useCreateDocument();
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={shellFr.create.menuLabel}
            aria-busy={pending || undefined}
            className="bg-card font-medium shadow-xs ring-1 ring-sidebar-border hover:bg-card hover:ring-foreground/20 data-[state=open]:bg-card data-[state=open]:ring-foreground/20"
          >
            {pending ? <Loader2 className="animate-spin text-brand-fg" aria-hidden /> : <Plus className="text-brand-fg" aria-hidden />}
            <span className="flex-1">{shellFr.create.menuLabel}</span>
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-(--radix-dropdown-menu-trigger-width) min-w-60">
          <DropdownMenuItem
            data-testid="sidebar-new-adressage"
            disabled={pending}
            onSelect={() => create("ADRESSAGE")}
          >
            {pendingType === "ADRESSAGE" ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            {shellFr.create.adressageMenu}
            <DropdownMenuShortcut>
              <Shortcut keys={["a"]} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="sidebar-new-compte_rendu"
            disabled={pending}
            onSelect={() => create("COMPTE_RENDU")}
          >
            {pendingType === "COMPTE_RENDU" ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardList aria-hidden />}
            {shellFr.create.compteRenduMenu}
            <DropdownMenuShortcut>
              <Shortcut keys={["c"]} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/patients?nouveau=1">
              <UserPlus aria-hidden /> {shellFr.create.newPatient}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/prescripteurs?nouveau=1">
              <Stethoscope aria-hidden /> {shellFr.create.newPrescriber}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/* ---------- Liens de navigation ---------- */

interface NavBadge {
  count: number;
  label: string;
  tone: "neutral" | "danger";
}

/** Icône du lien ; remplacée par un indicateur pendant le chargement de la page demandée. */
function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />;
}

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge: NavBadge | null;
  onNavigate: () => void;
}) {
  const tooltip: ReactNode = (
    <span className="flex items-center gap-2">
      {item.label}
      {badge ? <span className="opacity-80">· {badge.label}</span> : null}
      {item.seq ? <KeySequence keys={item.seq} /> : null}
    </span>
  );
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={{ children: tooltip }}>
        <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
          <NavIcon icon={item.icon} />
          <span className="flex-1">{item.label}</span>
          {badge ? <span className="sr-only">{`, ${badge.label}`}</span> : null}
        </Link>
      </SidebarMenuButton>
      {badge ? (
        <>
          <SidebarMenuBadge
            aria-hidden
            className={cn(
              "top-1/2! right-1.5 -translate-y-1/2 rounded-full px-1.5",
              badge.tone === "danger"
                ? "bg-destructive-fill font-semibold text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white"
                : "bg-muted text-muted-foreground peer-hover/menu-button:text-muted-foreground peer-data-active/menu-button:text-muted-foreground",
            )}
          >
            {badge.count}
          </SidebarMenuBadge>
          {/* Barre repliée : un point signale le compteur (le nombre reste lu dans le lien). */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1 right-1 hidden size-2 rounded-full ring-2 ring-sidebar group-data-[collapsible=icon]:block",
              badge.tone === "danger" ? "bg-destructive-fill" : "bg-primary",
            )}
          />
        </>
      ) : null}
    </SidebarMenuItem>
  );
}

/* ---------- Menu du compte ---------- */

function UserMenu({ user }: { user: SidebarProps["user"] }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { isMobile, state, toggleSidebar } = useSidebar();
  const { openHelp } = useCommandPalette();

  async function signOut() {
    await authClient.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  const avatar = (
    <Avatar className="size-8 rounded-lg">
      <AvatarFallback className="rounded-lg bg-accent text-xs font-medium text-accent-foreground">{user.initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="px-1.5 data-[state=open]:bg-sidebar-accent"
              data-testid="user-menu"
            >
              {avatar}
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{fr.roles[user.role]}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile || state === "expanded" ? "top" : "right"}
            align={isMobile || state === "expanded" ? "start" : "end"}
            className="w-64"
          >
            <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
              {avatar}
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium text-foreground">{user.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </DropdownMenuLabel>
            <div className="px-2.5 pb-1.5">
              <Badge tone="neutral">{fr.roles[user.role]}</Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/compte">
                <UserRound aria-hidden /> {fr.nav.account}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SunMoon aria-hidden /> {fr.nav.theme}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                <DropdownMenuRadioGroup value={theme ?? "light"} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <Sun aria-hidden /> {fr.nav.themeLight}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon aria-hidden /> {fr.nav.themeDark}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor aria-hidden /> {fr.nav.themeSystem}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {isMobile ? null : (
              <>
                <DropdownMenuItem onSelect={openHelp} className="pointer-coarse:hidden">
                  <Keyboard aria-hidden /> {S.shortcuts}
                  <DropdownMenuShortcut>
                    <Shortcut keys={["?"]} />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleSidebar}>
                  <PanelLeftClose aria-hidden /> {state === "expanded" ? S.collapse : S.expand}
                  <DropdownMenuShortcut>
                    <Shortcut keys={["mod", "b"]} />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut aria-hidden /> {fr.nav.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

