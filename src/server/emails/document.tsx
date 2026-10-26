import { Text } from "@react-email/components";
import { EmailButton, EmailLayout, Paragraphs, type EmailBrand } from "./layout";

/** E-mail au prescripteur : corps issu du modèle de l'organisation + accès au document. */
export function DocumentEmail({
  brand,
  before,
  after,
  link,
  accessNote,
  preview,
}: {
  brand: EmailBrand;
  before: string;
  after: string;
  link: string | null;
  accessNote: string;
  preview: string;
}) {
  return (
    <EmailLayout brand={brand} preview={preview}>
      <Paragraphs text={before} />
      {link ? (
        <>
          <EmailButton href={link} label="Consulter le document" color={brand.primary} />
          <Text style={{ fontSize: 13, color: "#6B7280", margin: "0 0 14px" }}>{accessNote}</Text>
        </>
      ) : (
        <Text style={{ margin: "0 0 14px" }}>{accessNote}</Text>
      )}
      <Paragraphs text={after} />
    </EmailLayout>
  );
}

export function AccessCodeEmail({ brand, code, validity }: { brand: EmailBrand; code: string; validity: string }) {
  return (
    <EmailLayout brand={brand} preview="Code d'accès au document">
      <Text>Bonjour,</Text>
      <Text>Voici le code d&apos;accès au document qui vient de vous être adressé dans un message séparé :</Text>
      <Text style={{ fontSize: 28, letterSpacing: 6, fontWeight: 700, textAlign: "center", margin: "24px 0" }}>{code}</Text>
      <Text style={{ fontSize: 13, color: "#6B7280" }}>Ce code est valable {validity}. Ne le transférez pas.</Text>
    </EmailLayout>
  );
}
