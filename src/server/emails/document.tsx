import { Text } from "@react-email/components";
import { emailFr } from "@/lib/i18n/email";
import { typo } from "@/lib/pdf/typography";
import {
  EmailButton,
  EmailLayout,
  EmailTitle,
  FallbackLink,
  InfoBox,
  InfoLine,
  P,
  Paragraphs,
  textFooter,
  type EmailBrand,
  type EmailContent,
} from "./layout";

const T = emailFr.document;

export interface DocumentEmailInput {
  brand: EmailBrand;
  /** Libellé du document et identification minimale du patient (« Compte rendu d'appareillage », « Mme J. DUPONT »). */
  documentLabel: string;
  patientLabel: string;
  /** Corps issu du modèle de l'organisation, avant et après le bloc d'accès. */
  before: string;
  after: string;
  access:
    | { mode: "secure-link"; link: string; factor: "birthdate" | "code"; expiresOn: string; centrePhone: string }
    | { mode: "attachment" };
}

/**
 * E-mail au prescripteur. Aucune information médicale : seulement le type de document et
 * l'identification minimale du patient ; le contenu se consulte par le lien sécurisé.
 */
export function documentEmail(raw: DocumentEmailInput): EmailContent {
  const input = { ...raw, before: typo(raw.before), after: typo(raw.after) };
  const { brand, access } = input;
  const preview =
    access.mode === "secure-link"
      ? T.previewLink(input.documentLabel, input.patientLabel, access.expiresOn)
      : T.previewAttachment(input.documentLabel, input.patientLabel);
  const element = (
    <EmailLayout brand={brand} preview={preview} notice={emailFr.confidential}>
      <Paragraphs text={input.before} brand={brand} />
      <InfoBox brand={brand}>
        <InfoLine brand={brand} label={T.documentLabel}>
          <strong>{input.documentLabel}</strong> — {input.patientLabel}
        </InfoLine>
        {access.mode === "secure-link" ? (
          <>
            <InfoLine brand={brand} label={T.accessLabel}>
              {access.factor === "birthdate" ? T.factorBirthdate : T.factorCode}
            </InfoLine>
            <InfoLine brand={brand} label={T.validLabel}>
              {access.expiresOn}
            </InfoLine>
          </>
        ) : (
          <InfoLine brand={brand}>{T.attached}</InfoLine>
        )}
      </InfoBox>
      {access.mode === "secure-link" ? (
        <>
          <EmailButton href={access.link} label={T.button} brand={brand} />
          <FallbackLink href={access.link} brand={brand} />
          <P brand={brand} muted>
            {T.expired(access.centrePhone)}
          </P>
        </>
      ) : null}
      <Paragraphs text={input.after} brand={brand} />
    </EmailLayout>
  );
  const text = [
    input.before,
    "",
    `${T.documentLabel} ${input.documentLabel} — ${input.patientLabel}`,
    ...(access.mode === "secure-link"
      ? [
          `${T.accessLabel} ${access.factor === "birthdate" ? T.factorBirthdate : T.factorCode}`,
          `${T.validLabel} ${access.expiresOn}`,
          "",
          `${T.button} : ${access.link}`,
          "",
          T.expired(access.centrePhone),
        ]
      : [T.attached]),
    "",
    input.after,
    "",
    textFooter(brand, emailFr.confidential),
  ].join("\n");
  return { element, text: text.replace(/\n{3,}/g, "\n\n").trim() };
}

/** Code d'accès (second facteur), envoyé dans un message distinct du lien. */
export function accessCodeEmail({
  brand,
  code,
  expiresOn,
  sender,
}: {
  brand: EmailBrand;
  code: string;
  expiresOn: string;
  sender: string;
}): EmailContent {
  const C = emailFr.accessCode;
  const element = (
    <EmailLayout brand={brand} preview={C.preview(sender)} notice={emailFr.confidential}>
      <EmailTitle brand={brand}>{C.title}</EmailTitle>
      <P brand={brand}>{C.intro(sender)}</P>
      <InfoBox brand={brand}>
        <Text
          className="em-ink"
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 30,
            lineHeight: "40px",
            letterSpacing: 8,
            fontWeight: 600,
            color: brand.colors.ink,
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label={code.split("").join(" ")}
        >
          {code}
        </Text>
      </InfoBox>
      <P brand={brand} muted>
        {C.validity(expiresOn)}
      </P>
    </EmailLayout>
  );
  const text = [
    C.title,
    "",
    C.intro(sender),
    "",
    `    ${code}`,
    "",
    C.validity(expiresOn),
    "",
    textFooter(brand, emailFr.confidential),
  ].join("\n");
  return { element, text };
}
