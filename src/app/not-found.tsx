import Link from "next/link";
import { House, SearchX } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/layout/status-screen";
import { BackButton } from "@/components/layout/status-actions";
import { getDefaultOrganization } from "@/server/repositories/organizations";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";

/** Page introuvable hors de l'application (adresse inconnue, lien public) : logo de la marque et retour. */
export default async function NotFound() {
  const org = await getDefaultOrganization().catch(() => null);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      {org ? (
        <Link href="/" aria-label={shellFr.header.homeLink(org.brand.name)} className="mb-4 rounded-md">
          <span className={org.brand.logo ? "inline-flex dark:rounded-lg dark:bg-white/95 dark:px-3 dark:py-1.5" : "inline-flex"}>
            <BrandLogo name={org.brand.name} logo={org.brand.logo} className="h-10" />
          </span>
        </Link>
      ) : null}
      <StatusScreen
        className="min-h-0 py-6"
        icon={<SearchX />}
        eyebrow={shellFr.errors.code404}
        title={fr.errors.notFoundTitle}
        description={fr.errors.notFoundDescription}
        actions={
          <>
            <BackButton />
            <Button asChild>
              <Link href="/">
                <House aria-hidden /> {fr.errors.backHome}
              </Link>
            </Button>
          </>
        }
      />
    </main>
  );
}
