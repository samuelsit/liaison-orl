import { cookies } from "next/headers";
import { AppHeader, HeaderBrand, HeaderMenuTrigger } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPaletteProvider, SearchButton, ShortcutsButton } from "@/components/layout/command-palette";
import { DemoBanner } from "@/components/layout/demo-banner";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { serviceModes } from "@/lib/env";
import { fr } from "@/lib/i18n/fr";
import { ERROR_STATUSES } from "@/lib/schemas/dispatch";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  const { user, organization, centres, activeCentre } = ctx;
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  // Même règle que la section « À finir » de l'accueil : brouillons du centre actif, quel que soit l'auteur.
  const [drafts, errors] = await Promise.all([
    collections().documents().countDocuments({ organizationId: user.organizationId, centreId: activeCentre._id, status: "BROUILLON" }),
    collections()
      .dispatches()
      .countDocuments({ organizationId: user.organizationId, centreId: activeCentre._id, status: { $in: [...ERROR_STATUSES] }, acknowledged: { $ne: true } }),
  ]);
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "?";
  const modes = serviceModes();
  const isAdmin = user.role === "admin";
  const brand = { name: organization.brand.name, logo: organization.brand.logo };
  const centreList = centres.map((c) => ({ id: c._id, name: c.name }));
  const counts = { drafts, errors };

  return (
    <CommandPaletteProvider
      isAdmin={isAdmin}
      canSend={can(user, "document.send", organization.settings)}
      centres={centreList}
      activeCentreId={activeCentre._id}
      demoOutbox={modes.email === "mock"}
    >
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        {fr.app.skipToContent}
      </a>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar
          brand={brand}
          centres={centreList}
          activeCentreId={activeCentre._id}
          user={{ fullName: user.fullName, email: user.email, role: user.role, initials }}
          counts={counts}
        />
        <SidebarInset className="min-w-0">
          <AppHeader>
            <HeaderMenuTrigger />
            <HeaderBrand brand={brand} />
            <SearchButton className="max-md:order-last" />
            <div className="ml-auto flex items-center gap-1">
              {isAdmin ? <DemoBanner modes={modes} /> : null}
              <ShortcutsButton className="max-md:hidden" />
            </div>
          </AppHeader>
          <main
            id="contenu"
            className="flex-1 px-4 pt-6 pb-[calc(1.5rem+var(--bottom-nav-height,0px))] sm:px-6 lg:px-8 lg:py-8"
          >
            {children}
          </main>
        </SidebarInset>
        <MobileTabBar counts={counts} />
      </SidebarProvider>
    </CommandPaletteProvider>
  );
}
