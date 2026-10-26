import "server-only";
import type { FontChoice } from "@/lib/schemas/organization";
import { measure, type Weight } from "./fonts";

export interface FontSpec {
  family: FontChoice;
  weight: Weight;
  size: number;
}

/** Découpe un texte en lignes (largeur de première ligne éventuellement différente). */
export function wrapText(text: string, font: FontSpec, firstWidth: number, otherWidth = firstWidth): string[] {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, "").split("\n");
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const width = lines.length === 0 ? firstWidth : otherWidth;
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate, font.family, font.weight, font.size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // Mot plus long que la ligne : on le coupe.
      let rest = word;
      const w2 = lines.length === 0 ? firstWidth : otherWidth;
      while (measure(rest, font.family, font.weight, font.size) > w2 && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measure(rest.slice(0, cut), font.family, font.weight, font.size) > w2) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Réduit la taille de police jusqu'à ce que le texte tienne sur une ligne, puis tronque. */
export function fitOneLine(text: string, font: FontSpec, maxWidth: number, minSize = 7): { text: string; size: number } {
  let size = font.size;
  while (size > minSize && measure(text, font.family, font.weight, size) > maxWidth) size -= 0.25;
  if (measure(text, font.family, font.weight, size) <= maxWidth) return { text, size };
  let t = text;
  while (t.length > 1 && measure(`${t}…`, font.family, font.weight, size) > maxWidth) t = t.slice(0, -1);
  return { text: `${t.trimEnd()}…`, size };
}

export interface RuledFit {
  mode: "ruled" | "free";
  size: number;
  lines: string[];
  lineHeight: number;
  overflow: boolean;
}

/**
 * Place un texte sur un nombre fixe de lignes réglées. Si le texte ne tient pas,
 * la police est réduite jusqu'à `minRuledSize`, puis on passe en mode libre
 * (lignes plus serrées) jusqu'à `minFreeSize`.
 */
export function fitRuled(
  text: string,
  font: Omit<FontSpec, "size">,
  opts: { firstWidth: number; otherWidth: number; rules: number; startSize: number; minRuledSize: number; freeHeight: number; minFreeSize: number; freeWidth: number },
): RuledFit {
  for (let size = opts.startSize; size >= opts.minRuledSize - 0.001; size -= 0.5) {
    const lines = wrapText(text, { ...font, size }, opts.firstWidth, opts.otherWidth);
    if (lines.length <= opts.rules) return { mode: "ruled", size, lines, lineHeight: 0, overflow: false };
  }
  for (let size = opts.minRuledSize; size >= opts.minFreeSize - 0.001; size -= 0.25) {
    const lineHeight = size * 1.22;
    const lines = wrapText(text, { ...font, size }, opts.freeWidth, opts.freeWidth);
    if (lines.length * lineHeight <= opts.freeHeight) return { mode: "free", size, lines, lineHeight, overflow: false };
  }
  const size = opts.minFreeSize;
  const lineHeight = size * 1.22;
  const all = wrapText(text, { ...font, size }, opts.freeWidth, opts.freeWidth);
  const max = Math.max(1, Math.floor(opts.freeHeight / lineHeight));
  const lines = all.slice(0, max);
  if (all.length > max) lines[max - 1] = `${lines[max - 1]!.replace(/\s*\S*$/, "")} …`;
  return { mode: "free", size, lines, lineHeight, overflow: all.length > max };
}
