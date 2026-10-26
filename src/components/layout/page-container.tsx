import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  /** Formulaires simples, /compte. */
  narrow: "max-w-3xl",
  /** Accueil, listes, fiches patient / ORL / envoi, administration. */
  default: "max-w-6xl",
  /** Écrans outils : éditeur, récapitulatif d'envoi. */
  wide: "max-w-[1560px]",
} as const;

export type PageContainerSize = keyof typeof SIZES;

/**
 * Largeur de page unique (cf. design §4.1). Les blocs enfants sont espacés de 24 px ;
 * le PageHeader garde sa propre marge basse.
 */
export function PageContainer({
  size = "default",
  className,
  ...props
}: ComponentProps<"div"> & { size?: PageContainerSize }) {
  return (
    <div
      data-slot="page-container"
      data-size={size}
      className={cn("mx-auto w-full min-w-0 space-y-6", SIZES[size], className)}
      {...props}
    />
  );
}
