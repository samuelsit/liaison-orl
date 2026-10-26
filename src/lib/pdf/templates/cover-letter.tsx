import "server-only";
import { Page } from "@react-pdf/renderer";
import { formatIsoDateLong } from "@/lib/dates";
import { formatPersonName } from "@/lib/text";
import { formatRecipientAddress, formatSenderAddress } from "@/lib/postal/address";
import type { PdfModel } from "../model";
import { wrapText } from "../layout";
import { FittedImage, HLine, T } from "../primitives";

/** 1 mm en points. */
const MM = 72 / 25.4;

/**
 * Zones Pingen pour une organisation française (fenêtre à droite) :
 * zone adresse x 110 mm, y 50 mm, 80 × 28 mm (marge de sécurité 3 mm) ;
 * zone de sécurité La Poste x 90 mm, y 30 mm, 115 × 64 mm (rien d'autre que l'adresse) ;
 * zones interdites : 5 mm des bords et 20 mm dans le coin supérieur droit.
 */
export const PINGEN_FR = {
  address: { x: 110 * MM, y: 50 * MM, w: 80 * MM, h: 28 * MM },
  safety: { x: 90 * MM, y: 30 * MM, w: 115 * MM, h: 64 * MM },
  margin: 3 * MM,
};

/** Page d'accompagnement de la version postale (expéditeur, destinataire dans la fenêtre, objet). */
export function CoverLetterPage({ model }: { model: PdfModel }) {
  const { brand, centre, author, patient, prescriber } = model;
  const c = brand.colors;
  const f = brand.font;
  const sender = formatSenderAddress(centre.displayName, centre.senderAddress ?? centre.address);
  const recipient = prescriber
    ? formatRecipientAddress({ civility: prescriber.civility, firstName: prescriber.firstName, lastName: prescriber.lastName, practiceName: prescriber.practiceName, address: prescriber.address }).lines
    : [];
  const dense = recipient.length >= 6;
  const addrSize = dense ? 9.5 : 10;
  const addrLead = dense ? 10.2 : 11.2;
  const ax = PINGEN_FR.address.x + PINGEN_FR.margin;
  const ay = PINGEN_FR.address.y + PINGEN_FR.margin + addrSize * 0.97;

  const date = model.type === "ADRESSAGE" ? model.data.date : model.data.reportDate;
  const place = `${centre.address.city ? `${centre.address.city}, le ` : "Le "}${formatIsoDateLong(date)}`;
  const patientLabel = patient ? `${patient.civility} ${formatPersonName(patient.firstName, patient.lastName)}` : "votre patient(e)";
  const docLabel = model.type === "ADRESSAGE" ? "Courrier d'adressage" : "Compte rendu d'appareillage";
  const salutation = (prescriber?.salutation || model.defaultSalutation || "Cher(e) Docteur").trim();
  const body =
    model.type === "ADRESSAGE"
      ? `Veuillez trouver ci-joint mon courrier d'adressage concernant ${patientLabel}.`
      : `Veuillez trouver ci-joint le compte rendu d'appareillage de ${patientLabel}.`;
  const paragraphs = [
    body,
    "Je reste à votre disposition pour tout renseignement complémentaire.",
    `Je vous prie d'agréer, ${salutation}, l'expression de mes salutations distinguées.`,
  ];
  let y = 372;
  const bodyLines: { text: string; y: number }[] = [];
  for (const p of paragraphs) {
    for (const line of wrapText(p, { family: f, weight: 400, size: 10.5 }, 505)) {
      bodyLines.push({ text: line, y });
      y += 15;
    }
    y += 8;
  }
  const signatureTop = y + 8;

  return (
    <Page size="A4" style={{ fontFamily: f, color: c.text, position: "relative" }}>
      {brand.logo ? <FittedImage src={brand.logo} x={42.52} y={34} w={150} h={36} align="left" /> : null}
      {sender.map((line, i) => (
        <T key={i} x={42.52} y={104 + i * 11} size={i === 0 ? 9 : 8.5} font={f} weight={i === 0 ? 700 : 400} color={i === 0 ? c.primary : c.text} width={200}>
          {line}
        </T>
      ))}
      {centre.phone ? (
        <T x={42.52} y={104 + sender.length * 11} size={8.5} font={f} color={c.text} width={200}>
          {`Tél. ${centre.phone}`}
        </T>
      ) : null}

      {/* Bloc destinataire : police sans empattement, noire, non grasse (norme La Poste). */}
      {recipient.map((line, i) => (
        <T key={i} x={ax} y={ay + i * addrLead} size={addrSize} font="Inter" color="#000000" width={PINGEN_FR.address.w - 2 * PINGEN_FR.margin}>
          {line}
        </T>
      ))}

      <T x={552.76} y={292} size={10} font={f} color={c.text} align="right" width={300}>
        {place}
      </T>
      <T x={42.52} y={324} size={10.5} font={f} weight={700} color={c.primary} width={510}>
        {`Objet : ${docLabel} — ${patientLabel}`}
      </T>
      <T x={42.52} y={338} size={9} font={f} color={c.muted} width={510}>
        Pièce jointe : 1 document
      </T>
      <T x={42.52} y={356} size={10.5} font={f} color={c.text} width={510}>
        {`${salutation},`}
      </T>
      {bodyLines.map((l, i) => (
        <T key={i} x={42.52} y={l.y} size={10.5} font={f} color={c.text} width={510}>
          {l.text}
        </T>
      ))}
      <T x={330} y={signatureTop + 10} size={10.5} font={f} weight={700} color={c.primary} width={222}>
        {formatPersonName(author.firstName, author.lastName)}
      </T>
      <T x={330} y={signatureTop + 24} size={9} font={f} color={c.muted} width={222}>
        {author.title}
      </T>
      {model.showSignature && author.signature ? <FittedImage src={author.signature} x={330} y={signatureTop + 30} w={140} h={60} align="left" /> : null}

      <HLine x1={42.52} x2={552.76} y={790} color={c.accent} width={1.2} />
      <T x={42.52} y={802} size={8} font={f} color={c.muted} width={510}>
        {[centre.displayName, [centre.address.line1, `${centre.address.postalCode} ${centre.address.city}`].filter(Boolean).join(", ")].filter(Boolean).join("  ·  ")}
      </T>
      <T x={42.52} y={812} size={8} font={f} color={c.muted} width={510}>
        {[centre.phone ? `Tél. ${centre.phone}` : "", centre.email].filter(Boolean).join("  ·  ")}
      </T>
    </Page>
  );
}
