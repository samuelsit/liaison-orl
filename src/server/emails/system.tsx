import { emailFr } from "@/lib/i18n/email";
import {
  EmailButton,
  EmailLayout,
  EmailTitle,
  FallbackLink,
  InfoBox,
  InfoLine,
  P,
  textFooter,
  type EmailBrand,
  type EmailContent,
} from "./layout";

/** E-mail d'action (titre, texte, bouton, lien de secours, mention finale) et sa version texte. */
function actionEmail({
  brand,
  preview,
  title,
  intro,
  button,
  url,
  note,
}: {
  brand: EmailBrand;
  preview: string;
  title: string;
  intro: string;
  button: string;
  url: string;
  note: string;
}): EmailContent {
  const element = (
    <EmailLayout brand={brand} preview={preview} notice={emailFr.automatic}>
      <EmailTitle brand={brand}>{title}</EmailTitle>
      <P brand={brand}>{intro}</P>
      <EmailButton href={url} label={button} brand={brand} />
      <FallbackLink href={url} brand={brand} />
      <P brand={brand} muted>
        {note}
      </P>
    </EmailLayout>
  );
  const text = [title, "", intro, "", `${button} : ${url}`, "", note, "", textFooter(brand, emailFr.automatic)].join(
    "\n",
  );
  return { element, text };
}

export function magicLinkEmail({ brand, url }: { brand: EmailBrand; url: string }): EmailContent {
  const M = emailFr.magicLink;
  return actionEmail({
    brand,
    preview: M.preview,
    title: M.title,
    intro: M.intro,
    button: M.button,
    url,
    note: M.ignore,
  });
}

export function invitationEmail({
  brand,
  url,
  firstName,
  inviter,
}: {
  brand: EmailBrand;
  url: string;
  firstName: string;
  inviter: string;
}): EmailContent {
  const I = emailFr.invitation;
  return actionEmail({
    brand,
    preview: I.preview(brand.name),
    title: I.title(firstName),
    intro: I.intro(inviter, brand.name),
    button: I.button,
    url,
    note: I.validity,
  });
}

export function resetPasswordEmail({ brand, url }: { brand: EmailBrand; url: string }): EmailContent {
  const R = emailFr.resetPassword;
  return actionEmail({
    brand,
    preview: R.preview,
    title: R.title,
    intro: R.intro,
    button: R.button,
    url,
    note: R.ignore,
  });
}

/** Notification à l'auteur d'un envoi en échec (refus d'adresse, rebond…), sans information médicale. */
export function dispatchErrorEmail({
  brand,
  url,
  documentLabel,
  patientLabel,
  channel,
  recipient,
  reason,
  hint,
}: {
  brand: EmailBrand;
  url: string;
  documentLabel: string;
  patientLabel: string;
  channel: "EMAIL" | "COURRIER";
  recipient: string;
  reason: string;
  hint: string;
}): EmailContent {
  const E = emailFr.dispatchError;
  const via = E.channels[channel];
  const docLower = documentLabel.charAt(0).toLowerCase() + documentLabel.slice(1);
  const intro = E.intro(docLower, patientLabel);
  const element = (
    <EmailLayout brand={brand} preview={E.preview(via, recipient)} notice={emailFr.automatic}>
      <EmailTitle brand={brand}>{E.title}</EmailTitle>
      <P brand={brand}>{intro}</P>
      <InfoBox brand={brand}>
        <InfoLine brand={brand} label={E.recipient}>
          {recipient}
        </InfoLine>
        <InfoLine brand={brand} label={E.channel}>
          {via}
        </InfoLine>
        <InfoLine brand={brand} label={E.reason}>
          {reason}
        </InfoLine>
        {hint ? (
          <InfoLine brand={brand} label={E.action}>
            {hint}
          </InfoLine>
        ) : null}
      </InfoBox>
      <EmailButton href={url} label={E.button} brand={brand} />
    </EmailLayout>
  );
  const text = [
    E.title,
    "",
    intro,
    "",
    `${E.recipient} ${recipient}`,
    `${E.channel} ${via}`,
    `${E.reason} ${reason}`,
    hint ? `${E.action} ${hint}` : "",
    "",
    `${E.button} : ${url}`,
    "",
    textFooter(brand, emailFr.automatic),
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  return { element, text };
}
