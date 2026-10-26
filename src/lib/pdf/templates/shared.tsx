import "server-only";
import { Path, Svg, View } from "@react-pdf/renderer";
import type { PdfBrand } from "../model";
import { FittedImage, PAGE_H, PAGE_W, Rect, T } from "../primitives";

/**
 * En-tête commun aux deux modèles (coordonnées relevées dans les PDF fournis,
 * en points, origine en haut à gauche) : logo centré, slogan, bandeau de titre.
 */
export function DocumentHeader({ brand, title }: { brand: PdfBrand; title: string }) {
  const c = brand.colors;
  return (
    <>
      {brand.logo ? (
        <FittedImage src={brand.logo} x={PAGE_W / 2 - 100} y={62.36 - 19.25} w={200} h={38.5} />
      ) : (
        <T x={PAGE_W / 2} y={70} size={20} font={brand.font} weight={700} color={c.primary} align="center" width={400}>
          {brand.name}
        </T>
      )}
      {brand.slogan ? (
        <T x={PAGE_W / 2} y={106.3} size={9} font={brand.font} weight={700} color={c.primary} align="center" width={400}>
          {brand.slogan}
        </T>
      ) : null}
      <Rect x={42.52} y={130.4} w={470.55} h={29.76} fill={c.primary} />
      <View style={{ position: "absolute", left: 0, top: 0, width: PAGE_W, height: 170 }}>
        <Svg width={PAGE_W} height={170} viewBox={`0 0 ${PAGE_W} 170`}>
          <Path d="M 513.07 160.16 L 547.09 160.16 L 552.76 130.39 L 518.74 130.39 Z" fill={c.accent} />
        </Svg>
      </View>
      <T x={42.52 + 470.55 / 2} y={149.78} size={16} font={brand.font} weight={700} color="#FFFFFF" align="center" width={470}>
        {title}
      </T>
    </>
  );
}

/** Pied de page en vagues du courrier d'adressage. `safe` = marges imprimeur respectées (version postale). */
export function WaveFooter({
  brand,
  lines,
  safe,
}: {
  brand: PdfBrand;
  lines: { title: string; line1: string; line2: string };
  safe: boolean;
}) {
  const c = brand.colors;
  const inset = safe ? 17 : 0;
  const w = PAGE_W - inset * 2;
  const bottom = PAGE_H - (safe ? 15 : 0);
  // Courbes du modèle, remises à l'échelle si la version postale impose des marges.
  const sx = (x: number) => inset + (x / PAGE_W) * w;
  const sy = (y: number) => bottom - y;
  const orange = `M ${sx(0)} ${sy(51.02)} C ${sx(178.58)} ${sy(73.7)} ${sx(327.4)} ${sy(42.52)} ${sx(595.28)} ${sy(73.7)} L ${sx(595.28)} ${bottom} L ${sx(0)} ${bottom} Z`;
  const blue = `M ${sx(0)} ${sy(28.35)} C ${sx(178.58)} ${sy(56.69)} ${sx(357.17)} ${sy(19.84)} ${sx(595.28)} ${sy(45.35)} L ${sx(595.28)} ${bottom} L ${sx(0)} ${bottom} Z`;
  return (
    <>
      <View style={{ position: "absolute", left: 0, top: 0, width: PAGE_W, height: PAGE_H }}>
        <Svg width={PAGE_W} height={PAGE_H} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}>
          <Path d={orange} fill={c.accent} />
          <Path d={blue} fill={c.primary} />
        </Svg>
      </View>
      <T x={42.52} y={sy(32.6)} size={9} font={brand.font} weight={700} color="#FFFFFF" width={510}>
        {lines.title}
      </T>
      <T x={42.52} y={sy(22.11)} size={8} font={brand.font} color="#FFFFFF" width={510}>
        {lines.line1}
      </T>
      <T x={42.52} y={sy(12.76)} size={8} font={brand.font} color="#FFFFFF" width={510}>
        {lines.line2}
      </T>
    </>
  );
}

export function formatAddressLine(a: { line1: string; line2: string; postalCode: string; city: string }): string {
  return [a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
