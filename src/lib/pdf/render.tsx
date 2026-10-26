import "server-only";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { registerFonts } from "./fonts";
import type { PdfModel, PdfVariant } from "./model";
import { AdressagePage } from "./templates/adressage";
import { CompteRenduPage, fitComments } from "./templates/compte-rendu";
import { CoverLetterPage } from "./templates/cover-letter";
import { AudiometryAnnexPage, CommentsContinuationPage, wantsAudiometryAnnex } from "./templates/annex";

export interface RenderInfo {
  pages: number;
  /** Le commentaire a été réduit pour tenir dans le cadre. */
  commentsCompressed: boolean;
  /** Une partie du commentaire est reportée en annexe. */
  commentsOverflow: boolean;
  /** Le motif « Autre » a été réduit pour tenir sur les lignes. */
  motifCompressed: boolean;
}

export function buildPdfElement(model: PdfModel, variant: PdfVariant = "standard"): { element: ReactElement<DocumentProps>; info: RenderInfo } {
  registerFonts();
  const pages: ReactElement[] = [];
  const info: RenderInfo = { pages: 0, commentsCompressed: false, commentsOverflow: false, motifCompressed: false };
  if (variant === "postal") pages.push(<CoverLetterPage key="cover" model={model} />);
  if (model.type === "ADRESSAGE") {
    pages.push(<AdressagePage key="main" model={model} safe={variant === "postal"} />);
  } else {
    const comments = fitComments(model.data.comments, model.brand.font);
    info.commentsCompressed = comments?.mode === "free" || (comments?.size ?? 9.5) < 9.5;
    info.commentsOverflow = Boolean(comments?.overflow);
    pages.push(<CompteRenduPage key="main" model={model} comments={comments} />);
    if (info.commentsOverflow) pages.push(<CommentsContinuationPage key="comments" model={model} />);
    if (wantsAudiometryAnnex(model)) pages.push(<AudiometryAnnexPage key="annex" model={model} />);
  }
  info.pages = pages.length;
  const title = model.type === "ADRESSAGE" ? "Courrier d'adressage" : "Compte rendu d'appareillage";
  const element = (
    <Document title={title} author={model.centre.displayName} subject={title} creator={model.brand.name} producer={model.brand.name} language="fr-FR">
      {pages}
    </Document>
  );
  return { element, info };
}

export async function renderPdf(model: PdfModel, variant: PdfVariant = "standard"): Promise<{ buffer: Buffer; info: RenderInfo }> {
  const { element, info } = buildPdfElement(model, variant);
  const buffer = await renderToBuffer(element);
  return { buffer, info };
}
