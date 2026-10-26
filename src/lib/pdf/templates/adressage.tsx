import "server-only";
import { Page } from "@react-pdf/renderer";
import { formatIsoDateLong } from "@/lib/dates";
import { formatPersonName } from "@/lib/text";
import type { PdfModel } from "../model";
import { measure } from "../fonts";
import { fitOneLine, fitRuled } from "../layout";
import { CheckBox, DraftWatermark, FittedImage, HLine, Rect, T } from "../primitives";
import { DocumentHeader, WaveFooter, formatAddressLine } from "./shared";

type AdressageModel = Extract<PdfModel, { type: "ADRESSAGE" }>;

/** Positions des lignes de base / traits du modèle « Courrier d'adressage ». */
const G = {
  salutationY: 194.17,
  adresseY: 222.52,
  adresseLine: { x1: 181.42, x2: 544.25, y: 223.94 },
  examsY: 242.36,
  boxes: [
    { top: 260.22, baseline: 269.29 },
    { top: 287.15, baseline: 296.22 },
    { top: 314.08, baseline: 323.15 },
  ],
  autreLine: { x1: 137.48, y: 325.98 },
  rules: [352.91, 378.43, 403.94],
  closingY: [439.37, 454.96],
  box: { x: 42.52, y: 486.14, w: 510.24, h: 138.9 },
};

export function AdressagePage({ model, safe }: { model: AdressageModel; safe: boolean }) {
  const { brand, centre, author, patient, prescriber, data } = model;
  const c = brand.colors;
  const f = brand.font;

  const salutation = (data.salutation || prescriber?.salutation || model.defaultSalutation || "Cher(e) Docteur").trim();
  const civilityLabel = patient?.civility ?? "Mme/M.";
  const label = `Je vous adresse ${civilityLabel}`;
  const labelEnd = 51.02 + measure(label, f, 400, 11);
  const nameX = Math.max(G.adresseLine.x1 + 3, labelEnd + 6);
  const patientName = patient ? fitOneLine(formatPersonName(patient.firstName, patient.lastName), { family: f, weight: 600, size: 11 }, G.adresseLine.x2 - nameX - 2) : null;

  const autreText = data.exams.autre ? data.autreText.trim() : "";
  const fit = autreText
    ? fitRuled(autreText, { family: f, weight: 500 }, {
        firstWidth: 544.25 - (G.autreLine.x1 + 4) - 2,
        otherWidth: 544.25 - 89.29 - 2,
        rules: 4,
        startSize: 11,
        minRuledSize: 9.5,
        freeHeight: 425 - 312,
        minFreeSize: 7.5,
        freeWidth: 544.25 - 89.29 - 2,
      })
    : null;
  const ruledBaselines = [323.15, 350.08, 375.6, 401.11];

  const authorName = formatPersonName(author.firstName, author.lastName);
  const city = centre.address.city;
  const place = `${city ? `${city}, le ` : "Le "}${formatIsoDateLong(data.date)}`;

  return (
    <Page size="A4" style={{ fontFamily: f, color: c.text, position: "relative" }}>
      <DocumentHeader brand={brand} title="COURRIER D'ADRESSAGE" />

      <T x={51.02} y={G.salutationY} size={12} font={f} color={c.text} width={500}>
        {`${salutation},`}
      </T>

      <T x={51.02} y={G.adresseY} size={11} font={f} color={c.text} width={300}>
        {label}
      </T>
      <HLine x1={G.adresseLine.x1} x2={G.adresseLine.x2} y={G.adresseLine.y} color={c.muted} />
      {patientName ? (
        <T x={nameX} y={G.adresseY} size={patientName.size} font={f} weight={600} color={c.primary} width={G.adresseLine.x2 - nameX}>
          {patientName.text}
        </T>
      ) : null}

      <T x={51.02} y={G.examsY} size={11} font={f} color={c.text} width={300}>
        pour les examens suivants :
      </T>

      {[
        { checked: data.exams.conduits, label: "Vérification des conduits auditifs externes" },
        { checked: data.exams.bilan, label: "Bilan auditif" },
        { checked: data.exams.autre, label: "Autre :" },
      ].map((item, i) => (
        <CheckBox key={item.label} x={65.2} y={G.boxes[i]!.top} size={11.91} color={c.primary} checked={item.checked} />
      ))}
      <T x={89.29} y={G.boxes[0]!.baseline} size={11} font={f} color={c.text} width={450}>
        Vérification des conduits auditifs externes
      </T>
      <T x={89.29} y={G.boxes[1]!.baseline} size={11} font={f} color={c.text} width={450}>
        Bilan auditif
      </T>
      <T x={89.29} y={G.boxes[2]!.baseline} size={11} font={f} color={c.text} width={60}>
        Autre :
      </T>

      {fit?.mode === "free" ? null : (
        <>
          <HLine x1={G.autreLine.x1} x2={544.25} y={G.autreLine.y} color={c.muted} />
          {G.rules.map((y) => (
            <HLine key={y} x1={89.29} x2={544.25} y={y} color={c.muted} />
          ))}
        </>
      )}
      {fit?.mode === "ruled"
        ? fit.lines.map((line, i) => (
            <T key={i} x={i === 0 ? G.autreLine.x1 + 4 : 89.29 + 2} y={ruledBaselines[i]!} size={fit.size} font={f} weight={500} color={c.primary} width={460}>
              {line}
            </T>
          ))
        : null}
      {fit?.mode === "free"
        ? fit.lines.map((line, i) => (
            <T key={i} x={i === 0 ? G.autreLine.x1 + 4 : 89.29 + 2} y={323.15 + i * fit.lineHeight} size={fit.size} font={f} weight={500} color={c.primary} width={460}>
              {line}
            </T>
          ))
        : null}

      <T x={51.02} y={G.closingY[0]!} size={11} font={f} color={c.text} width={500}>
        {"Je reste à votre disposition et vous prie d'agréer,"}
      </T>
      <T x={51.02} y={G.closingY[1]!} size={11} font={f} color={c.text} width={500}>
        {"l'expression de mes salutations distinguées."}
      </T>

      <Rect x={G.box.x} y={G.box.y} w={G.box.w} h={G.box.h} fill={c.surface} stroke={c.border} strokeWidth={0.6} radius={6} />
      <Rect x={42.52} y={486.14} w={3.4} h={138.9} fill={c.accent} />
      <T x={62.36} y={505.98} size={10} font={f} weight={700} color={c.primary} width={250}>
        VOTRE AUDIOPROTHÉSISTE
      </T>
      <T x={535.75} y={505.98} size={9} font={f} color={c.text} align="right" width={260}>
        {place}
      </T>
      <T x={62.36} y={528.66} size={10.5} font={f} color={c.text} width={50}>
        Nom :
      </T>
      <HLine x1={102.05} x2={535.75} y={530.08} color={c.muted} />
      {authorName ? (
        <T x={105} y={528.66} size={10.5} font={f} weight={600} color={c.primary} width={300}>
          {authorName}
        </T>
      ) : null}
      <T x={102.05} y={544.25} size={9} font={f} color={c.muted} width={300}>
        {author.title || "Audioprothésiste D.E"}
      </T>
      <T x={62.36} y={566.93} size={10.5} font={f} color={c.text} width={60}>
        Centre :
      </T>
      <T x={110.55} y={566.93} size={10.5} font={f} weight={700} color={c.primary} width={330}>
        {centre.displayName}
      </T>
      <T x={62.36} y={586.77} size={10.5} font={f} color={c.text} width={60}>
        Adresse :
      </T>
      <T x={116.22} y={586.77} size={10.5} font={f} color={c.text} width={310}>
        {formatAddressLine(centre.address)}
      </T>
      <T x={62.36} y={606.61} size={10.5} font={f} color={c.text} width={70}>
        Téléphone :
      </T>
      <T x={130.39} y={606.61} size={10.5} font={f} weight={700} color={c.primary} width={200}>
        {centre.phone}
      </T>
      {model.showSignature && author.signature ? <FittedImage src={author.signature} x={430} y={548} w={110} h={68} align="right" /> : null}

      <WaveFooter
        brand={brand}
        safe={safe}
        lines={{
          title: centre.displayName.toLocaleUpperCase("fr-FR"),
          line1: [centre.address.line1, centre.address.line2].filter(Boolean).join(", "),
          line2: `${[centre.address.postalCode, centre.address.city].filter(Boolean).join(" ")}${centre.phone ? `   ·   Tél. ${centre.phone}` : ""}`,
        }}
      />
      {model.draft ? <DraftWatermark font={f} /> : null}
    </Page>
  );
}
