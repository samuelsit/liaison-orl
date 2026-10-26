import "server-only";
import { Image, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { FontChoice } from "@/lib/schemas/organization";
import { ascent, type Weight } from "./fonts";

export const PAGE_W = 595.276;
/** Le modèle a été composé sans crénage : on le désactive pour un rendu identique. */
export const NO_KERNING = { kern: false, liga: false, clig: false } as const;
export const PAGE_H = 841.89;

/** Texte positionné par sa ligne de base (coordonnées du modèle, origine en haut à gauche). */
export function T({
  x,
  y,
  size,
  font,
  weight = 400,
  color,
  children,
  width,
  align = "left",
}: {
  x: number;
  y: number;
  size: number;
  font: FontChoice;
  weight?: Weight;
  color: string;
  children: ReactNode;
  width?: number;
  align?: "left" | "center" | "right";
}) {
  const top = y - ascent(font, weight, size);
  const left = align === "left" ? x : align === "center" ? x - (width ?? 400) / 2 : x - (width ?? 400);
  return (
    <Text
      style={{
        position: "absolute",
        left,
        top,
        width: align === "left" ? width : (width ?? 400),
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1,
        color,
        textAlign: align,
        fontFeatureSettings: NO_KERNING,
      }}
    >
      {children}
    </Text>
  );
}

/** Trait horizontal tracé (épaisseur centrée sur y, comme dans le modèle). */
export function HLine({ x1, x2, y, color, width = 0.6 }: { x1: number; x2: number; y: number; color: string; width?: number }) {
  const pad = 1;
  return (
    <View style={{ position: "absolute", left: x1, top: y - pad, width: x2 - x1, height: pad * 2 }}>
      <Svg width={x2 - x1} height={pad * 2} viewBox={`0 0 ${x2 - x1} ${pad * 2}`}>
        <Path d={`M 0 ${pad} L ${x2 - x1} ${pad}`} stroke={color} strokeWidth={width} />
      </Svg>
    </View>
  );
}

/** Rectangle (arrondi) tracé comme dans le modèle : trait centré sur le contour. */
export function Rect({
  x,
  y,
  w,
  h,
  fill,
  stroke,
  strokeWidth = 0,
  radius = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}) {
  const pad = strokeWidth / 2 + 0.5;
  return (
    <View style={{ position: "absolute", left: x - pad, top: y - pad, width: w + pad * 2, height: h + pad * 2 }}>
      <Svg width={w + pad * 2} height={h + pad * 2} viewBox={`0 0 ${w + pad * 2} ${h + pad * 2}`}>
        <Path
          d={radius > 0 ? roundedRectPath(pad, pad, w, h, radius) : `M ${pad} ${pad} L ${pad + w} ${pad} L ${pad + w} ${pad + h} L ${pad} ${pad + h} Z`}
          fill={fill ?? "none"}
          {...(stroke ? { stroke, strokeWidth } : {})}
        />
      </Svg>
    </View>
  );
}

/**
 * Case à cocher arrondie ; cochée = remplie avec une coche blanche.
 * (x, y, size) = rectangle du tracé dans le modèle ; le trait de 1,1 pt est centré dessus.
 */
export function CheckBox({ x, y, size, color, checked }: { x: number; y: number; size: number; color: string; checked: boolean }) {
  const s = 1.1;
  const outer = size + s;
  return (
    <View style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: outer, height: outer }}>
      <Svg width={outer} height={outer} viewBox={`0 0 ${outer} ${outer}`}>
        <Path d={roundedRectPath(s / 2, s / 2, size, size, 2)} fill={checked ? color : "#FFFFFF"} stroke={color} strokeWidth={s} />
        {checked ? (
          <Path
            d={`M ${s / 2 + size * 0.24} ${s / 2 + size * 0.53} L ${s / 2 + size * 0.43} ${s / 2 + size * 0.72} L ${s / 2 + size * 0.77} ${s / 2 + size * 0.3}`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={size * 0.14}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

/** Rectangle arrondi en courbes de Bézier cubiques (k = 0,5523), identique au tracé du modèle. */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const k = r * 0.5523;
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `C ${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `C ${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `C ${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `C ${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

/** Image (logo, signature) ajustée dans une boîte en conservant les proportions. */
export function FittedImage({ src, x, y, w, h, align = "center" }: { src: string; x: number; y: number; w: number; h: number; align?: "center" | "left" | "right" }) {
  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={src} style={{ maxWidth: w, maxHeight: h, objectFit: "contain" }} />
    </View>
  );
}

/** Filigrane « Aperçu » des brouillons. */
export function DraftWatermark({ font }: { font: FontChoice }) {
  return (
    <Text
      fixed
      style={{
        position: "absolute",
        left: 0,
        top: 380,
        width: PAGE_W,
        textAlign: "center",
        fontFamily: font,
        fontWeight: 700,
        fontSize: 64,
        color: "#1F2937",
        opacity: 0.06,
        transform: "rotate(-30deg)",
      }}
    >
      BROUILLON
    </Text>
  );
}
