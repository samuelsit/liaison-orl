import "server-only";
import { Fragment } from "react";
import { Circle, Page, Svg, View } from "@react-pdf/renderer";
import { formatIsoDate } from "@/lib/dates";
import { formatPersonName, upperName, capitalizeName } from "@/lib/text";
import type { CompteRenduData } from "@/lib/schemas/document";
import type { FontChoice } from "@/lib/schemas/organization";
import type { PdfModel } from "../model";
import { measure, type Weight } from "../fonts";
import { fitOneLine, fitRuled, type RuledFit } from "../layout";
import { CheckBox, DraftWatermark, FittedImage, HLine, PAGE_W, Rect, T } from "../primitives";
import { DocumentHeader, formatAddressLine } from "./shared";

type CrModel = Extract<PdfModel, { type: "COMPTE_RENDU" }>;

const BOX = 9.92;
const boxTop = (baseline: number) => baseline - 7.09;

const PILLS = [
  { label: "Informations patient", top: 256.54, w: 136.06, bar: 40.82, baseline: 267.02 },
  { label: "Aide(s) auditive(s) choisie(s)", top: 338.74, w: 170.08, bar: 51.02, baseline: 349.23 },
  { label: "Résultats prothétiques", top: 521.58, w: 153.07, bar: 45.92, baseline: 532.06 },
  { label: "Commentaires", top: 620.79, w: 107.72, bar: 32.31, baseline: 631.28 },
];

const COMMENT_RULES = [640.63, 656.22, 671.81, 687.4];
/** La première ligne de commentaire commence après la pastille « Commentaires ». */
const COMMENT_FIRST_X = 42.52 + 107.72 + 6;

/** Prépare le placement du commentaire (lignes réglées, ou texte resserré s'il est long). */
export function fitComments(text: string, font: FontChoice): RuledFit | null {
  const t = text.trim();
  if (!t) return null;
  return fitRuled(t, { family: font, weight: 500 }, {
    firstWidth: 547.09 - COMMENT_FIRST_X - 2,
    otherWidth: 547.09 - 48.19 - 4,
    rules: 4,
    startSize: 9.5,
    minRuledSize: 8.5,
    freeHeight: 707 - 637.5,
    minFreeSize: 7,
    freeWidth: 547.09 - 48.19 - 4,
  });
}

interface Opt<V> {
  value: V;
  label: string;
  box: number;
  text: number;
}

function Options<V>({ options, selected, baseline, color, textColor, font }: { options: Opt<V>[]; selected: V | null | undefined; baseline: number; color: string; textColor: string; font: FontChoice }) {
  return (
    <>
      {options.map((o) => (
        <Fragment key={o.label}>
          <CheckBox x={o.box} y={boxTop(baseline)} size={BOX} color={color} checked={selected === o.value} />
          <T x={o.text} y={baseline} size={10} font={font} color={textColor} width={140}>
            {o.label}
          </T>
        </Fragment>
      ))}
    </>
  );
}

/** Valeur saisie sur une ligne pointillée : démarre après l'étiquette, réduite si trop longue. */
function FieldValue({ text, labelX, label, labelSize, lineX1, lineX2, baseline, font, color, weight = 600, size = 9.5 }: {
  text: string;
  labelX: number;
  label: string;
  labelSize: number;
  lineX1: number;
  lineX2: number;
  baseline: number;
  font: FontChoice;
  color: string;
  weight?: Weight;
  size?: number;
}) {
  if (!text) return null;
  const start = Math.max(lineX1 + 2, labelX + measure(label, font, 700, labelSize) + 4);
  const fit = fitOneLine(text, { family: font, weight, size }, lineX2 - start - 1, 6.5);
  return (
    <T x={start} y={baseline} size={fit.size} font={font} weight={weight} color={color} width={lineX2 - start}>
      {fit.text}
    </T>
  );
}

function priceLabel(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "";
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} €`;
}

export function CompteRenduPage({ model, comments }: { model: CrModel; comments: RuledFit | null }) {
  const { brand, centre, author, patient, prescriber } = model;
  const d: CompteRenduData = model.data;
  const c = brand.colors;
  const f = brand.font;
  const doctorLabel = prescriber && (prescriber.civility === "Pr" || prescriber.civility === "Dr") ? `${prescriber.civility} :` : "Dr :";
  const doctorName = prescriber
    ? prescriber.civility === "Dr" || prescriber.civility === "Pr"
      ? formatPersonName(prescriber.firstName, prescriber.lastName)
      : `${prescriber.civility} ${formatPersonName(prescriber.firstName, prescriber.lastName)}`
    : "";
  const signature = model.showSignature && author.signature ? author.signature : null;
  const authorLineEnd = signature ? 430 : 537.17;
  const v = { font: f, color: c.primary };

  return (
    <Page size="A4" style={{ fontFamily: f, color: c.text, position: "relative" }}>
      <DocumentHeader brand={brand} title="COMPTE RENDU D'APPAREILLAGE" />

      {/* Cartouche d'identification */}
      <Rect x={42.52} y={180} w={510.24} h={56.69} fill={c.surface} stroke={c.border} strokeWidth={0.5} radius={5} />
      {[
        { label: "Date du jour :", x: 59.53, line: [132.35, 223.06], y: 198.43, value: formatIsoDate(d.reportDate) },
        { label: doctorLabel, x: 218.27, line: [240.63, 371.02], y: 198.43, value: doctorName },
        { label: "Date d'ordonnance :", x: 377.01, line: [483.4, 535.75], y: 198.43, value: formatIsoDate(d.prescriptionDate) },
        { label: "Nom :", x: 59.53, line: [93.04, 217.77], y: 222.52, value: patient ? upperName(patient.lastName) : "" },
        { label: "Prénom :", x: 218.27, line: [266.81, 380.2], y: 222.52, value: patient ? capitalizeName(patient.firstName) : "" },
        { label: "Date de naissance :", x: 377.01, line: [479.6, 535.75], y: 222.52, value: patient ? formatIsoDate(patient.birthDate) : "" },
      ].map((fld) => (
        <Fragment key={fld.label + fld.y}>
          <T x={fld.x} y={fld.y} size={9.5} font={f} weight={700} color={c.primary} width={140}>
            {fld.label}
          </T>
          <HLine x1={fld.line[0]!} x2={fld.line[1]!} y={fld.y + 1.42} color={c.muted} />
          <FieldValue text={fld.value} label={fld.label} labelSize={9.5} labelX={fld.x} lineX1={fld.line[0]!} lineX2={fld.line[1]!} baseline={fld.y} {...v} />
        </Fragment>
      ))}

      {/* Pastilles de section */}
      {PILLS.map((p) => (
        <Fragment key={p.label}>
          <Rect x={42.52} y={p.top} w={p.w} h={15.59} fill={c.primary} radius={3} />
          <Rect x={48.19} y={p.top + 15.59} w={p.bar} h={2.27} fill={c.accent} />
          <T x={51.02} y={p.baseline} size={10} font={f} weight={700} color="#FFFFFF" width={p.w}>
            {p.label}
          </T>
        </Fragment>
      ))}

      {/* Informations patient */}
      <T x={48.19} y={287.72} size={10} font={f} weight={700} color={c.text} width={120}>
        Degré de surdité :
      </T>
      <Options
        baseline={287.72}
        selected={d.degree}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: "legere", label: "Légère", box: 161.57, text: 175.75 },
          { value: "moyenne", label: "Moyenne", box: 257.95, text: 272.13 },
          { value: "severe", label: "Sévère", box: 354.33, text: 368.5 },
          { value: "profonde", label: "Profonde", box: 450.71, text: 464.88 },
        ]}
      />
      <T x={48.19} y={308.98} size={10} font={f} weight={700} color={c.text} width={140}>
        Oreille(s) appareillée(s) :
      </T>
      <Options
        baseline={308.98}
        selected={d.ears}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: "droite", label: "Droite", box: 178.58, text: 192.76 },
          { value: "gauche", label: "Gauche", box: 274.96, text: 289.13 },
          { value: "deux", label: "Les deux", box: 371.34, text: 385.51 },
        ]}
      />

      {/* Aide(s) auditive(s) */}
      <View style={{ position: "absolute", left: 0, top: 360, width: PAGE_W, height: 50 }}>
        <Svg width={PAGE_W} height={50} viewBox={`0 0 ${PAGE_W} 50`}>
          {[127.56, 297.64, 467.72].map((cx) => (
            <Circle key={cx} cx={cx} cy={384.09 - 360} r={19.84} fill={c.tint} />
          ))}
        </Svg>
      </View>
      {["1", "2", "3"].map((n, i) => (
        <T key={n} x={[127.56, 297.64, 467.72][i]!} y={392.6} size={18} font={f} weight={700} color={c.primary} align="center" width={40}>
          {n}
        </T>
      ))}
      <Options
        baseline={415.28}
        selected={d.deviceType}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: "intra", label: "Intra-auriculaire", box: 82.2, text: 99.21 },
          { value: "ecouteur_deporte", label: "Écouteur déporté", box: 252.28, text: 269.29 },
          { value: "contour", label: "Contour classique", box: 422.36, text: 439.37 },
        ]}
      />
      <T x={48.19} y={432.28} size={10} font={f} weight={700} color={c.text} width={60}>
        Marque :
      </T>
      <Options
        baseline={432.28}
        selected={d.deviceBrand}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: "signia", label: "Signia", box: 110.55, text: 124.72 },
          { value: "starkey", label: "Starkey", box: 204.09, text: 218.27 },
          { value: "resound", label: "GN ReSound", box: 297.64, text: 311.81 },
          { value: "autre", label: "Autre :", box: 391.18, text: 405.35 },
        ]}
      />
      <HLine x1={453.54} x2={544.25} y={433.7} color={c.muted} />
      {d.deviceBrand === "autre" ? (
        <FieldValue text={d.deviceBrandOther} label="" labelSize={10} labelX={453.54} lineX1={453.54} lineX2={544.25} baseline={432.28} {...v} />
      ) : null}

      <T x={48.19} y={452.13} size={10} font={f} weight={700} color={c.text} width={60}>
        Modèle :
      </T>
      <HLine x1={90.71} x2={297.64} y={453.54} color={c.muted} />
      <FieldValue text={d.deviceModel} label="Modèle :" labelSize={10} labelX={48.19} lineX1={90.71} lineX2={297.64} baseline={452.13} {...v} />
      <T x={308.98} y={452.13} size={10} font={f} weight={700} color={c.text} width={100}>
        Prix par appareil :
      </T>
      <HLine x1={399.69} x2={544.25} y={453.54} color={c.muted} />
      <FieldValue text={priceLabel(d.pricePerDevice)} label="Prix par appareil :" labelSize={10} labelX={308.98} lineX1={399.69} lineX2={544.25} baseline={452.13} {...v} />

      <T x={48.19} y={471.97} size={10} font={f} weight={700} color={c.text} width={50}>
        Classe :
      </T>
      <Options
        baseline={471.97}
        selected={d.deviceClass}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: "cmu", label: "CMU", box: 90.71, text: 104.88 },
          { value: "1", label: "1", box: 150.24, text: 164.41 },
          { value: "2", label: "2", box: 195.59, text: 209.76 },
        ]}
      />
      <T x={308.98} y={471.97} size={10} font={f} weight={700} color={c.text} width={90}>
        Rechargeable :
      </T>
      <Options
        baseline={471.97}
        selected={d.rechargeable}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: true, label: "Oui", box: 396.85, text: 411.02 },
          { value: false, label: "Non", box: 453.54, text: 467.72 },
        ]}
      />
      <T x={48.19} y={491.81} size={10} font={f} weight={700} color={c.text} width={130}>
        Embout(s) sur mesure :
      </T>
      <Options
        baseline={491.81}
        selected={d.customEarmolds}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: true, label: "Oui", box: 167.24, text: 181.42 },
          { value: false, label: "Non", box: 223.94, text: 238.11 },
        ]}
      />

      {/* Résultats prothétiques */}
      <T x={48.19} y={551.34} size={10} font={f} weight={700} color={c.text} width={130}>
        Durée de port moyen :
      </T>
      <HLine x1={172.91} x2={297.64} y={552.76} color={c.muted} />
      <FieldValue text={d.wearDuration} label="Durée de port moyen :" labelSize={10} labelX={48.19} lineX1={172.91} lineX2={297.64} baseline={551.34} {...v} />
      <T x={308.98} y={551.34} size={10} font={f} weight={700} color={c.text} width={60}>
        Heures :
      </T>
      <HLine x1={357.17} x2={439.37} y={552.76} color={c.muted} />
      <FieldValue
        text={d.wearHoursPerDay === null ? "" : `${String(d.wearHoursPerDay).replace(".", ",")} h`}
        label="Heures :"
        labelSize={10}
        labelX={308.98}
        lineX1={357.17}
        lineX2={439.37}
        baseline={551.34}
        {...v}
      />
      <T x={442.2} y={551.34} size={9.5} font={f} color={c.text} width={40}>
        /Jour
      </T>
      <T x={48.19} y={571.18} size={10} font={f} weight={700} color={c.text} width={160}>
        {"Motivation à l'appareillage :"}
      </T>
      <Options
        baseline={571.18}
        selected={d.motivation}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: "peu", label: "Peu motivé(e)", box: 201.26, text: 215.43 },
          { value: "moderee", label: "Modérée", box: 308.98, text: 323.16 },
          { value: "active", label: "Participation active", box: 395.32, text: 409.49 },
        ]}
      />
      <T x={48.19} y={591.02} size={10} font={f} weight={700} color={c.text} width={180}>
        Acquisition de la manipulation :
      </T>
      <Options
        baseline={591.02}
        selected={d.handling}
        color={c.primary}
        textColor={c.text}
        font={f}
        options={[
          { value: "oui", label: "Oui", box: 223.94, text: 238.11 },
          { value: "non", label: "Non", box: 279.66, text: 293.83 },
          { value: "a_travailler", label: "À travailler", box: 338.3, text: 352.47 },
        ]}
      />

      {/* Commentaires */}
      {comments?.mode === "free" ? null : COMMENT_RULES.map((y) => <HLine key={y} x1={48.19} x2={547.09} y={y} color={c.muted} />)}
      {comments?.mode === "ruled"
        ? comments.lines.map((line, i) => (
            <T key={i} x={i === 0 ? COMMENT_FIRST_X : 50.19} y={COMMENT_RULES[i]! - 2.6} size={comments.size} font={f} weight={500} color={c.primary} width={498}>
              {line}
            </T>
          ))
        : null}
      {comments?.mode === "free"
        ? comments.lines.map((line, i) => (
            <T key={i} x={i === 0 ? COMMENT_FIRST_X : 50.19} y={637.5 + comments.size * 0.95 + i * comments.lineHeight} size={comments.size} font={f} weight={500} color={c.primary} width={498}>
              {line}
            </T>
          ))
        : null}

      {/* Pied : audioprothésiste et centre */}
      <Rect x={42.52} y={711.5} w={510.24} h={82.2} fill={c.primary} radius={5} />
      <Rect x={42.52} y={790.87} w={178.58} h={2.83} fill={c.accent} />
      <View style={{ position: "absolute", left: 50, top: 720, width: 20, height: 62 }}>
        <Svg width={20} height={62} viewBox="0 0 20 62">
          {[728.5, 744.09, 759.69, 775.28].map((cy) => (
            <Circle key={cy} cx={59.53 - 50} cy={cy - 720} r={5.1} fill={c.accent} />
          ))}
        </Svg>
      </View>
      <T x={82.2} y={734.17} size={10} font={f} weight={700} color="#FFFFFF" width={100}>
        Audioprothésiste :
      </T>
      <HLine x1={172.91} x2={authorLineEnd} y={735.59} color={c.footerLine} width={0.5} />
      {author.firstName || author.lastName ? (
        <T x={Math.max(175.5, 82.2 + measure("Audioprothésiste :", f, 700, 10) + 6)} y={734.17} size={10} font={f} weight={700} color="#FFFFFF" width={authorLineEnd - 176}>
          {formatPersonName(author.firstName, author.lastName)}
        </T>
      ) : null}
      <T x={82.2} y={749.76} size={10} font={f} weight={700} color="#FFFFFF" width={60}>
        Centre :
      </T>
      <T x={130.39} y={749.76} size={10} font={f} color="#FFFFFF" width={signature ? 300 : 400}>
        {centre.displayName}
      </T>
      <T x={82.2} y={765.35} size={10} font={f} weight={700} color="#FFFFFF" width={60}>
        Adresse :
      </T>
      <T x={136.06} y={765.35} size={10} font={f} color="#FFFFFF" width={signature ? 296 : 400}>
        {formatAddressLine(centre.address)}
      </T>
      <T x={82.2} y={780.95} size={10} font={f} weight={700} color="#FFFFFF" width={70}>
        Téléphone :
      </T>
      <T x={150.24} y={780.95} size={10} font={f} weight={700} color="#FFFFFF" width={200}>
        {centre.phone}
      </T>
      {signature ? (
        <>
          <Rect x={440} y={717} w={104} h={68} fill="#FFFFFF" radius={4} />
          <FittedImage src={signature} x={444} y={720} w={96} h={62} />
        </>
      ) : null}
      {model.draft ? <DraftWatermark font={f} /> : null}
    </Page>
  );
}
