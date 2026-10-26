import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

export interface EmailBrand {
  name: string;
  primary: string;
  accent: string;
  text: string;
  logoUrl: string | null;
  footer: string;
}

export function EmailLayout({ brand, preview, children }: { brand: EmailBrand; preview: string; children: ReactNode }) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#F4F6FA", fontFamily: "Inter, Arial, Helvetica, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#FFFFFF", borderRadius: 12, maxWidth: 560, margin: "0 auto", overflow: "hidden" }}>
          <Section style={{ padding: "24px 32px 8px", textAlign: "center" }}>
            {brand.logoUrl ? (
              <Img src={brand.logoUrl} alt={brand.name} height={56} style={{ margin: "0 auto", height: 56, width: "auto" }} />
            ) : (
              <Text style={{ color: brand.primary, fontSize: 20, fontWeight: 700, margin: 0 }}>{brand.name}</Text>
            )}
          </Section>
          <Section style={{ height: 4, backgroundColor: brand.primary }}>
            <Text style={{ margin: 0, fontSize: 1, lineHeight: "4px" }}>&nbsp;</Text>
          </Section>
          <Section style={{ padding: "24px 32px", color: brand.text, fontSize: 15, lineHeight: "24px" }}>{children}</Section>
          <Hr style={{ borderColor: "#E5E7EB", margin: 0 }} />
          <Section style={{ padding: "16px 32px" }}>
            <Text style={{ color: "#6B7280", fontSize: 12, lineHeight: "18px", margin: 0 }}>{brand.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <Section style={{ textAlign: "center", margin: "24px 0" }}>
      <a
        href={href}
        style={{
          backgroundColor: color,
          color: "#FFFFFF",
          borderRadius: 8,
          padding: "12px 24px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        {label}
      </a>
    </Section>
  );
}

export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <Text key={i} style={{ margin: "0 0 14px", whiteSpace: "pre-line" }}>
          {p}
        </Text>
      ))}
    </>
  );
}
