import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

/**
 * Logo de la marque posé sur une plaque claire, pour qu'il reste lisible sur un fond
 * sombre (mode sombre, panneau de marque). `plate="dark"` : plaque en mode sombre seulement.
 * Sans logo configuré, le nom de la marque s'affiche en texte (sans plaque).
 */
export function LogoPlate({
  name,
  logo,
  plate = "always",
  className,
  logoClassName,
}: {
  name: string;
  logo: string | null;
  plate?: "always" | "dark";
  className?: string;
  logoClassName?: string;
}) {
  if (!logo) return <BrandLogo name={name} logo={null} className={logoClassName} />;
  return (
    <span
      className={cn(
        "inline-flex items-center",
        plate === "always"
          ? "rounded-xl bg-white px-3 py-2 shadow-xs ring-1 ring-black/5 dark:bg-white/95"
          : "dark:rounded-xl dark:bg-white/95 dark:px-3 dark:py-2 dark:shadow-xs dark:ring-1 dark:ring-black/5",
        className,
      )}
    >
      <BrandLogo name={name} logo={logo} className={logoClassName} />
    </span>
  );
}
