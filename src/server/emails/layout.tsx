import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactElement, ReactNode } from "react";

/**
 * Gabarit unique des e-mails : 600 px, fond blanc, logo, filet bleu avec accent orange,
 * contenu, pied sobre. Couleurs issues de la marque (voir emailBrand) ; mode sombre et
 * affichage mobile gérés par les styles de l'en-tête.
 */
export interface EmailBrand {
  name: string;
  logoUrl: string | null;
  logoWidth: number;
  logoHeight: number;
  colors: {
    primary: string;
    accent: string;
    ink: string;
    label: string;
    hairline: string;
    tint: string;
    primaryDark: string;
    buttonDark: string;
  };
  /** Pied : expéditeur (centre ou marque), coordonnées, mentions légales. */
  footer: { sender: string; lines: string[]; legal: string };
}

/** Contenu d'un e-mail : élément React (HTML) et version texte brut écrite à la main. */
export interface EmailContent {
  element: ReactElement;
  text: string;
}

export const FONT_STACK = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";

/** Couleurs fixes du mode sombre (fond, texte), lisibles quand le client inverse les couleurs. */
const DARK = { bg: "#0F141C", ink: "#E8EBF0", label: "#A7B0BD", hairline: "#2B3442", tint: "#18202B" };

function darkCss(b: EmailBrand): string {
  return `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .em-body, .em-container { background-color: ${DARK.bg} !important; }
  .em-ink { color: ${DARK.ink} !important; }
  .em-label { color: ${DARK.label} !important; }
  .em-primary { color: ${b.colors.primaryDark} !important; }
  .em-hr { border-color: ${DARK.hairline} !important; }
  .em-rule { background-color: ${b.colors.primaryDark} !important; }
  .em-box { background-color: ${DARK.tint} !important; border-color: ${DARK.hairline} !important; }
  .em-button { background-color: ${b.colors.buttonDark} !important; border-color: ${b.colors.buttonDark} !important; }
  .em-link { color: ${b.colors.primaryDark} !important; }
}
[data-ogsc] .em-ink { color: ${DARK.ink} !important; }
[data-ogsc] .em-label { color: ${DARK.label} !important; }
[data-ogsc] .em-primary, [data-ogsc] .em-link { color: ${b.colors.primaryDark} !important; }
@media only screen and (max-width: 480px) {
  .em-container { padding: 20px 16px !important; }
  .em-title { font-size: 19px !important; line-height: 26px !important; }
}
a { text-decoration: underline; }
`;
}

export function EmailLayout({
  brand,
  preview,
  notice,
  children,
}: {
  brand: EmailBrand;
  preview: string;
  notice?: string;
  children: ReactNode;
}) {
  const c = brand.colors;
  return (
    <Html lang="fr" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="x-apple-disable-message-reformatting" />
        <link href={GOOGLE_FONTS} rel="stylesheet" />
        <style>{darkCss(brand)}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="em-body"
        style={{
          backgroundColor: "#FFFFFF",
          margin: 0,
          padding: 0,
          fontFamily: FONT_STACK,
          WebkitTextSizeAdjust: "100%",
        }}
      >
        <Container
          className="em-container"
          width={600}
          style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "24px", backgroundColor: "#FFFFFF" }}
        >
          <Section>
            {brand.logoUrl ? (
              // Plaque blanche : le logo reste lisible quand le client passe en mode sombre.
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                style={{ backgroundColor: "#FFFFFF", borderRadius: 6 }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: 6 }}>
                      <Img
                        src={brand.logoUrl}
                        alt={brand.name}
                        width={brand.logoWidth}
                        height={brand.logoHeight}
                        style={{ display: "block", border: 0, outline: "none" }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <Text
                className="em-primary"
                style={{ margin: 0, fontSize: 20, lineHeight: "28px", fontWeight: 600, color: c.primary }}
              >
                {brand.name}
              </Text>
            )}
          </Section>
          <AccentRule brand={brand} />
          <Section className="em-ink" style={{ color: c.ink, fontSize: 16, lineHeight: "24px" }}>
            {children}
          </Section>
          <Hr className="em-hr" style={{ borderColor: c.hairline, borderTopWidth: 1, margin: "32px 0 16px" }} />
          <EmailFooter brand={brand} notice={notice} />
        </Container>
      </Body>
    </Html>
  );
}

/** Filet fin bleu, précédé d'un court segment orange. */
function AccentRule({ brand }: { brand: EmailBrand }) {
  const cell: CSSProperties = { fontSize: 0, lineHeight: "0px", padding: 0 };
  return (
    <Section style={{ margin: "20px 0 28px" }}>
      <Row>
        <Column width={32} style={{ ...cell, width: 32, height: 2, backgroundColor: brand.colors.accent }}>
          &nbsp;
        </Column>
        <Column
          className="em-rule"
          style={{ ...cell, height: 1, backgroundColor: brand.colors.primary, verticalAlign: "top" }}
        >
          &nbsp;
        </Column>
      </Row>
    </Section>
  );
}

function EmailFooter({ brand, notice }: { brand: EmailBrand; notice?: string }) {
  const small: CSSProperties = { margin: 0, fontSize: 13, lineHeight: "20px", color: brand.colors.label };
  return (
    <Section>
      <Text className="em-label" style={{ ...small, fontWeight: 600 }}>
        {brand.footer.sender}
      </Text>
      {brand.footer.lines.map((l) => (
        <Text key={l} className="em-label" style={small}>
          {l}
        </Text>
      ))}
      {brand.footer.legal ? (
        <Text className="em-label" style={{ ...small, marginTop: 12 }}>
          {brand.footer.legal}
        </Text>
      ) : null}
      {notice ? (
        <Text className="em-label" style={{ ...small, marginTop: 12 }}>
          {notice}
        </Text>
      ) : null}
    </Section>
  );
}

export function EmailTitle({ brand, children }: { brand: EmailBrand; children: ReactNode }) {
  return (
    <Text
      className="em-title em-primary"
      style={{ margin: "0 0 16px", fontSize: 20, lineHeight: "28px", fontWeight: 600, color: brand.colors.primary }}
    >
      {children}
    </Text>
  );
}

export function P({ children, muted, brand }: { children: ReactNode; muted?: boolean; brand: EmailBrand }) {
  return (
    <Text
      className={muted ? "em-label" : "em-ink"}
      style={{
        margin: "0 0 16px",
        fontSize: muted ? 14 : 16,
        lineHeight: muted ? "21px" : "24px",
        color: muted ? brand.colors.label : brand.colors.ink,
      }}
    >
      {children}
    </Text>
  );
}

/** Texte libre (modèle de l'organisation) : un paragraphe par bloc séparé d'une ligne vide. */
export function Paragraphs({ text, brand }: { text: string; brand: EmailBrand }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <Text
            key={i}
            className="em-ink"
            style={{
              margin: "0 0 16px",
              whiteSpace: "pre-line",
              fontSize: 16,
              lineHeight: "24px",
              color: brand.colors.ink,
            }}
          >
            {p.trim()}
          </Text>
        ))}
    </>
  );
}

/** Encadré d'information (fond très clair). */
export function InfoBox({ brand, children }: { brand: EmailBrand; children: ReactNode }) {
  return (
    <Section
      className="em-box"
      style={{
        backgroundColor: brand.colors.tint,
        border: `1px solid ${brand.colors.hairline}`,
        borderRadius: 6,
        padding: "14px 16px",
        margin: "0 0 20px",
      }}
    >
      {children}
    </Section>
  );
}

export function InfoLine({ brand, label, children }: { brand: EmailBrand; label?: string; children: ReactNode }) {
  return (
    <Text className="em-ink" style={{ margin: "0 0 6px", fontSize: 14, lineHeight: "21px", color: brand.colors.ink }}>
      {label ? (
        <span className="em-label" style={{ color: brand.colors.label, fontWeight: 500 }}>
          {label}{" "}
        </span>
      ) : null}
      {children}
    </Text>
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Bouton principal compatible Outlook : forme VML pour Outlook Windows, lien stylé
 * ailleurs ; 48 px de haut (cible tactile ≥ 44 px), coins arrondis à 6 px.
 */
export function EmailButton({
  href,
  label,
  brand,
  width = 280,
}: {
  href: string;
  label: string;
  brand: EmailBrand;
  width?: number;
}) {
  const bg = brand.colors.primary;
  const url = escapeHtml(href);
  const text = escapeHtml(label);
  const html = `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="13%" stroke="f" fillcolor="${bg}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center></v:roundrect><![endif]--><!--[if !mso]><!-- --><a href="${url}" class="em-button" target="_blank" style="background-color:${bg};border:1px solid ${bg};border-radius:6px;color:#FFFFFF;display:inline-block;font-family:${FONT_STACK.replace(/'/g, "")};font-size:16px;font-weight:600;line-height:46px;min-width:${width - 2}px;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;mso-hide:all;">${text}</a><!--<![endif]-->`;
  return (
    <Section style={{ margin: "8px 0 20px" }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </Section>
  );
}

export function FallbackLink({ href, brand }: { href: string; brand: EmailBrand }) {
  return (
    <Text
      className="em-label"
      style={{
        margin: "0 0 20px",
        fontSize: 13,
        lineHeight: "20px",
        color: brand.colors.label,
        wordBreak: "break-all",
      }}
    >
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:{" "}
      <Link className="em-link" href={href} style={{ color: brand.colors.primary }}>
        {href}
      </Link>
    </Text>
  );
}

/** Pied de la version texte brut. */
export function textFooter(brand: EmailBrand, notice?: string): string {
  return ["—", brand.footer.sender, ...brand.footer.lines, brand.footer.legal, notice ? `\n${notice}` : ""]
    .filter(Boolean)
    .join("\n");
}
