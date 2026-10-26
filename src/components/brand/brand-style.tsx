import { FONT_CSS_VAR } from "@/app/fonts";
import { brandCssVariables, DEFAULT_COLORS, DEFAULT_FONTS } from "@/lib/brand";
import type { Brand } from "@/lib/schemas/organization";

const HEX = /^#[0-9a-fA-F]{6}$/;
const safe = (v: string, fallback: string) => (HEX.test(v) ? v : fallback);

/** Injecte les couleurs et polices de la marque sous forme de variables CSS. */
export function BrandStyle({ brand }: { brand: Pick<Brand, "colors" | "fonts"> | null }) {
  const colors = brand?.colors ?? DEFAULT_COLORS;
  const fonts = brand?.fonts ?? DEFAULT_FONTS;
  const primary = safe(colors.primary, DEFAULT_COLORS.primary);
  const accent = safe(colors.accent, DEFAULT_COLORS.accent);
  const vars = Object.entries(brandCssVariables(primary, accent))
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  const css = `:root{${vars}--app-font-sans:${FONT_CSS_VAR[fonts.body]},ui-sans-serif,system-ui,sans-serif;--app-font-heading:${FONT_CSS_VAR[fonts.heading]},${FONT_CSS_VAR[fonts.body]},sans-serif;}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
