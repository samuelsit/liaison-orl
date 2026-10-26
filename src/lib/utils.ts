import { createCn } from "cn/config";

/**
 * Fusion de classes Tailwind (clsx + résolution des conflits). Déclare les
 * paliers typographiques propres au projet (globals.css) pour qu'ils ne soient
 * pas confondus avec des couleurs de texte (`text-meta text-muted-foreground`).
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["2xs", "meta", "display"] }] } },
});
