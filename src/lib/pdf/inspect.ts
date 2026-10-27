import "server-only";
import { MM, PAGE } from "./tokens";
import { PINGEN_ZONES, contains, edgeZones, intersects, type Zone } from "./zones";

/** Élément imprimé sur une page, boîte en mm depuis le coin haut gauche. */
export interface InkBox extends Zone {
  kind: "text" | "path" | "image";
  /** Texte (pour les éléments textuels), utile dans les messages d'erreur. */
  label: string;
}

export interface PageInk {
  page: number;
  boxes: InkBox[];
}

type Matrix = [number, number, number, number, number, number];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Boîte alignée (espace PDF, origine en bas à gauche) → mm depuis le haut gauche. */
function toMm(pageHeightPt: number, xs: number[], ys: number[]): Zone {
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { x: x0 / MM, y: (pageHeightPt - y1) / MM, w: (x1 - x0) / MM, h: (y1 - y0) / MM };
}

/** Jambages d'Inter (fraction du corps) : boîte de texte prudente, au-delà des glyphes réels. */
const ASCENT = 0.97;
const DESCENT = 0.25;

/**
 * Extrait les boîtes englobantes de tout ce qui est imprimé (texte, tracés, images)
 * sur chaque page d'un PDF, à partir de la liste d'opérateurs de pdf.js.
 */
export async function inspectPdf(pdf: Buffer): Promise<PageInk[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { OPS } = pdfjs;
  const paintOps = new Set<number>([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const strokeOps = new Set<number>([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const task = pdfjs.getDocument({
    data: new Uint8Array(pdf),
    verbosity: 0,
    useSystemFonts: false,
    disableFontFace: true,
  });
  const doc = await task.promise;
  const pages: PageInk[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const [, , , pageH] = page.view as [number, number, number, number];
    const boxes: InkBox[] = [];

    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, , , d, e, f] = item.transform as Matrix;
      const size = Math.abs(d) || item.height;
      boxes.push({
        kind: "text",
        label: item.str,
        ...toMm(pageH, [e, e + item.width], [f - DESCENT * size, f + ASCENT * size]),
      });
    }

    const ops = await page.getOperatorList();
    let ctm: Matrix = [1, 0, 0, 1, 0, 0];
    let lineWidth = 1;
    const stack: { ctm: Matrix; lineWidth: number }[] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]!;
      const args = ops.argsArray[i] as unknown[] | null;
      if (fn === OPS.save) stack.push({ ctm, lineWidth });
      else if (fn === OPS.restore) ({ ctm, lineWidth } = stack.pop() ?? { ctm, lineWidth });
      else if (fn === OPS.transform) ctm = multiply(ctm, args as unknown as Matrix);
      else if (fn === OPS.setLineWidth) lineWidth = Number(args?.[0] ?? 1);
      else if (fn === OPS.constructPath) {
        const op = Number(args?.[0]);
        const minMax = args?.[2] as ArrayLike<number> | null | undefined;
        if (!paintOps.has(op) || !minMax || !Number.isFinite(minMax[0]!)) continue;
        const pad = strokeOps.has(op) ? lineWidth / 2 : 0;
        const corners = [
          apply(ctm, minMax[0]! - pad, minMax[1]! - pad),
          apply(ctm, minMax[2]! + pad, minMax[1]! - pad),
          apply(ctm, minMax[0]! - pad, minMax[3]! + pad),
          apply(ctm, minMax[2]! + pad, minMax[3]! + pad),
        ];
        boxes.push({
          kind: "path",
          label: "tracé",
          ...toMm(
            pageH,
            corners.map((c) => c[0]),
            corners.map((c) => c[1]),
          ),
        });
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintImageMaskXObject
      ) {
        const corners = [apply(ctm, 0, 0), apply(ctm, 1, 0), apply(ctm, 0, 1), apply(ctm, 1, 1)];
        boxes.push({
          kind: "image",
          label: "image",
          ...toMm(
            pageH,
            corners.map((c) => c[0]),
            corners.map((c) => c[1]),
          ),
        });
      }
    }
    pages.push({ page: n, boxes: boxes.filter((b) => b.w > 0.01 || b.h > 0.01) });
  }
  await task.destroy();
  return pages;
}

export interface ZoneViolation {
  page: number;
  rule: string;
  box: InkBox;
}

const fmt = (z: Zone) =>
  `x ${z.x.toFixed(1)}–${(z.x + z.w).toFixed(1)} mm, y ${z.y.toFixed(1)}–${(z.y + z.h).toFixed(1)} mm`;
export const describeViolation = (v: ZoneViolation) =>
  `page ${v.page} — ${v.rule} : ${v.box.kind} « ${v.box.label.slice(0, 40)} » (${fmt(v.box)})`;

/**
 * Contrôle des règles Pingen. Toutes les pages et toutes les versions : rien dans le
 * bord bloqué ni dans la zone DMC. Version postale, page 1 : dans la zone
 * d'affranchissement, seules les lignes de l'adresse, entièrement dans la zone d'adresse.
 */
export function checkPingenZones(
  pages: PageInk[],
  opts: { postal: boolean; addressLines?: string[] },
): ZoneViolation[] {
  const violations: ZoneViolation[] = [];
  const edges = edgeZones(PAGE.width, PAGE.height);
  const lines = opts.addressLines ?? [];
  const isAddressText = (b: InkBox) =>
    b.kind === "text" && lines.some((l) => l.includes(b.label.trim()) || b.label.trim().includes(l));
  for (const { page, boxes } of pages) {
    for (const box of boxes) {
      if (edges.some((z) => intersects(box, z))) violations.push({ page, rule: "bord bloqué (5 mm)", box });
      if (intersects(box, PINGEN_ZONES.dmcGuard))
        violations.push({ page, rule: "zone DMC (haut droite, 3 mm de garde)", box });
      if (!opts.postal || page !== 1 || !intersects(box, PINGEN_ZONES.postage)) continue;
      if (!isAddressText(box))
        violations.push({ page, rule: "élément autre que l'adresse dans la zone d'affranchissement", box });
      else if (!contains(PINGEN_ZONES.address, box))
        violations.push({ page, rule: "adresse hors de la zone d'adresse", box });
    }
  }
  if (opts.postal) {
    const found = (pages[0]?.boxes ?? []).filter((b) => isAddressText(b) && contains(PINGEN_ZONES.address, b));
    const missing = lines.filter((l) => !found.some((b) => l.includes(b.label.trim()) || b.label.trim().includes(l)));
    if (lines.length === 0 || missing.length) {
      violations.push({
        page: 1,
        rule: `adresse absente ou incomplète dans la zone d'adresse (${missing.join(" / ") || "aucune ligne"})`,
        box: { kind: "text", label: lines.join(" / "), ...PINGEN_ZONES.address },
      });
    }
  }
  return violations;
}
