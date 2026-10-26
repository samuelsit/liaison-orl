import "server-only";
import { Page } from "@react-pdf/renderer";
import { formatPersonName } from "@/lib/text";
import type { PdfModel } from "../model";
import { wrapText } from "../layout";
import { DraftWatermark, Rect, T } from "../primitives";
import { DocumentHeader } from "./shared";
import { AudiometryAnnex } from "./audiometry-annex";

type CrModel = Extract<PdfModel, { type: "COMPTE_RENDU" }>;

export function wantsAudiometryAnnex(model: CrModel): boolean {
  return Boolean(model.data.includeAnnex && model.audiometry);
}

function patientLine(model: CrModel) {
  const p = model.patient;
  return p ? `${p.civility} ${formatPersonName(p.firstName, p.lastName)}` : "";
}

/** Page 2 facultative : bilan audiométrique redessiné, mesures et gain prothétique. */
export function AudiometryAnnexPage({ model }: { model: CrModel }) {
  const { brand } = model;
  return (
    <Page size="A4" style={{ fontFamily: brand.font, color: brand.colors.text, position: "relative" }}>
      <DocumentHeader brand={brand} title="ANNEXE — BILAN AUDIOMÉTRIQUE" />
      <T x={42.52} y={182} size={10} font={brand.font} weight={700} color={brand.colors.primary} width={510}>
        {patientLine(model)}
      </T>
      {model.audiometry ? <AudiometryAnnex audiometry={model.audiometry} brand={brand} top={190} /> : null}
      <T x={42.52} y={812} size={7} font={brand.font} color={brand.colors.muted} width={510}>
        Mesures issues du bilan auditif joint, relues et validées par l&apos;audioprothésiste. Calculs réalisés automatiquement (perte moyenne BIAP, gain prothétique).
      </T>
      {model.draft ? <DraftWatermark font={brand.font} /> : null}
    </Page>
  );
}

/** Suite du commentaire lorsqu'il ne tient pas dans le cadre de la page 1. */
export function CommentsContinuationPage({ model }: { model: CrModel }) {
  const { brand } = model;
  const c = brand.colors;
  const lines = wrapText(model.data.comments.trim(), { family: brand.font, weight: 400, size: 10 }, 505);
  return (
    <Page size="A4" style={{ fontFamily: brand.font, color: c.text, position: "relative" }}>
      <DocumentHeader brand={brand} title="COMPTE RENDU — COMMENTAIRES" />
      <T x={42.52} y={182} size={10} font={brand.font} weight={700} color={c.primary} width={510}>
        {patientLine(model)}
      </T>
      <Rect x={42.52} y={196} w={107.72} h={15.59} fill={c.primary} radius={3} />
      <T x={51.02} y={206.5} size={10} font={brand.font} weight={700} color="#FFFFFF" width={140}>
        Commentaires
      </T>
      {lines.slice(0, 40).map((line, i) => (
        <T key={i} x={44} y={236 + i * 14} size={10} font={brand.font} color={c.text} width={505}>
          {line}
        </T>
      ))}
      {model.draft ? <DraftWatermark font={brand.font} /> : null}
    </Page>
  );
}
