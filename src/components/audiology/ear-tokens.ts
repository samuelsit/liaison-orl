import type { EarGroup } from "./measure-cells";

/*
 * Couleurs conventionnelles de l'audiométrie à l'écran, par thème (AA ≥ 4,5:1 sur
 * les surfaces claires et sombres) : oreille droite rouge, gauche bleue, champ
 * libre gris (sans) / vert (avec). Le PDF garde ses propres constantes (chart.ts).
 * À poser sur l'élément racine qui utilise `var(--ear-*)`.
 */
export const earTokens =
  "[--ear-right:#c62828] [--ear-left:#1565c0] [--ear-unaided:#5f6b7a] [--ear-aided:#1e7b4a] " +
  "dark:[--ear-right:#ff8f85] dark:[--ear-left:#7fb0ff] dark:[--ear-unaided:#a7b1c0] dark:[--ear-aided:#5fd394]";

/** Variable CSS de couleur d'une série d'audiogramme (clé de chart.ts) ou d'une ligne du tableau. */
export function earColorVar(key: string): string {
  if (key.startsWith("right")) return "var(--ear-right)";
  if (key.startsWith("left")) return "var(--ear-left)";
  if (key.includes("unaided")) return "var(--ear-unaided)";
  return "var(--ear-aided)";
}

/** Classe de couleur de texte d'une oreille (en-têtes de ligne du tableau). */
export const EAR_TEXT: Record<EarGroup, string> = {
  right: "text-(--ear-right)",
  left: "text-(--ear-left)",
  freeField: "text-muted-foreground",
};
