import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { fontVariables } from "./fonts";
import { AppProviders } from "@/components/providers/app-providers";
import { BrandStyle } from "@/components/brand/brand-style";
import { getDefaultOrganization } from "@/server/repositories/organizations";
import { fr } from "@/lib/i18n/fr";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await getDefaultOrganization().catch(() => null);
  const title = org ? `${fr.app.productName} · ${org.brand.name}` : fr.app.productName;
  return {
    title: { default: title, template: `%s · ${title}` },
    description: fr.app.tagline,
    robots: { index: false, follow: false },
    icons: org?.brand.logo ? { icon: `/api/marque/logo?o=${org._id}` } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Plein écran sur iPhone : les barres du bas réservent la zone sûre (env(safe-area-inset-bottom)).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const org = await getDefaultOrganization().catch(() => null);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fr" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <BrandStyle brand={org?.brand ?? null} />
      </head>
      <body className="min-h-full">
        <AppProviders nonce={nonce}>{children}</AppProviders>
      </body>
    </html>
  );
}
