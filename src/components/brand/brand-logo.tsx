/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** Logo de la marque (data URL issue de la configuration) ou nom en toutes lettres. */
export function BrandLogo({ name, logo, className }: { name: string; logo: string | null; className?: string }) {
  if (logo) return <img src={logo} alt={name} className={cn("h-10 w-auto object-contain", className)} />;
  return <span className={cn("font-heading text-lg font-bold text-brand-fg", className)}>{name}</span>;
}
