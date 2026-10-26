import { FileText, ShieldCheck, Sparkles } from "lucide-react";
import { LogoPlate } from "@/components/auth/logo-plate";
import { getDefaultOrganization } from "@/server/repositories/organizations";
import { authFr } from "@/lib/i18n/auth";
import { fr } from "@/lib/i18n/fr";

const BENEFITS = [
  { icon: FileText, label: authFr.brandPanel.benefits.adressage },
  { icon: Sparkles, label: authFr.brandPanel.benefits.compteRendu },
  { icon: ShieldCheck, label: authFr.brandPanel.benefits.envoi },
] as const;

/**
 * Écrans publics d'authentification : panneau de marque (≥ lg, collant, pleine hauteur)
 * et colonne de formulaire centrée. Couleurs et logo viennent de la configuration.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const org = await getDefaultOrganization().catch(() => null);
  const name = org?.brand.name ?? fr.app.productName;
  const logo = org?.brand.logo ?? null;
  const slogan = org?.brand.slogan ?? "";
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(420px,5fr)_7fr]">
      <aside className="relative isolate hidden overflow-hidden bg-brand text-(--brand-on-primary) lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-12 xl:p-14 print:hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_70%_at_0%_0%,color-mix(in_oklab,var(--brand-primary),white_16%),transparent_60%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(55%_35%_at_100%_100%,color-mix(in_oklab,var(--brand-accent),transparent_62%),transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] mask-[linear-gradient(to_bottom,black,transparent_70%)] bg-size-[20px_20px]"
        />
        <div>
          <LogoPlate name={name} logo={logo} logoClassName="h-11 text-xl text-(--brand-on-primary)" className="px-4 py-2.5" />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-10 py-10">
          <div className="space-y-3">
            <p className="font-heading text-4xl leading-tight font-bold">{fr.app.productName}</p>
            <p className="max-w-sm text-lg leading-relaxed text-(--brand-on-primary)/85">{fr.app.tagline}</p>
          </div>
          <ul className="space-y-4" aria-label={authFr.brandPanel.benefitsLabel}>
            {BENEFITS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--brand-on-primary)/10 ring-1 ring-(--brand-on-primary)/15">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="text-[15px] leading-snug text-(--brand-on-primary)/90">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="min-h-4 max-w-[70%] pb-14 text-xs tracking-[0.2em] text-(--brand-on-primary)/75 uppercase">{slogan}</p>
        <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full" viewBox="0 0 600 56" preserveAspectRatio="none">
          <path d="M0 26 C180 2 330 42 600 10 L600 56 L0 56 Z" fill="var(--brand-accent)" opacity="0.9" />
          <path d="M0 42 C180 20 360 54 600 32 L600 56 L0 56 Z" fill="rgba(255,255,255,0.12)" />
        </svg>
      </aside>
      <main id="contenu" className="flex min-w-0 flex-col items-center justify-center px-5 py-8 sm:px-10 sm:py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden print:hidden">
            <LogoPlate name={name} logo={logo} plate="dark" logoClassName="h-12 text-xl" />
          </div>
          {children}
        </div>
        <p className="mt-10 max-w-md text-center text-meta text-muted-foreground print:hidden">{authFr.brandPanel.help}</p>
      </main>
    </div>
  );
}
