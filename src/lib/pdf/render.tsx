import "server-only";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { pdfFr } from "@/lib/i18n/pdf";
import { registerFonts } from "./fonts";
import type { PdfModel, PdfRenderOptions, PdfVariant } from "./model";
import { AdressagePage } from "./templates/adressage";
import { CompteRenduPage } from "./templates/compte-rendu";

export interface RenderInfo {
  pages: number;
}

export function buildPdfElement(
  model: PdfModel,
  variant: PdfVariant = "standard",
  options: PdfRenderOptions = {},
): ReactElement<DocumentProps> {
  registerFonts();
  const title = pdfFr.titles[model.type];
  return (
    <Document
      title={title}
      author={model.centre.displayName}
      subject={title}
      creator={model.brand.name}
      producer={model.brand.name}
      language="fr-FR"
    >
      {model.type === "ADRESSAGE" ? (
        <AdressagePage model={model} variant={variant} options={options} />
      ) : (
        <CompteRenduPage model={model} variant={variant} options={options} />
      )}
    </Document>
  );
}

/** Nombre de pages d'un PDF produit par react-pdf. */
export function countPages(pdf: Buffer): number {
  return Math.max(1, (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length);
}

/**
 * Les rendus sont exécutés l'un après l'autre : les polices sont rechargées avant chaque
 * document (voir registerFonts), ce qui ne doit pas se produire pendant un autre rendu.
 */
let queue: Promise<unknown> = Promise.resolve();

export function renderPdf(
  model: PdfModel,
  variant: PdfVariant = "standard",
  options: PdfRenderOptions = {},
): Promise<{ buffer: Buffer; info: RenderInfo }> {
  const run = queue.then(async () => {
    const buffer = await renderToBuffer(buildPdfElement(model, variant, options));
    return { buffer, info: { pages: countPages(buffer) } };
  });
  queue = run.catch(() => undefined);
  return run;
}
