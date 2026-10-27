import "server-only";
import { Image, Text, View } from "@react-pdf/renderer";
import { Children, type ReactNode } from "react";
import { pdfFr } from "@/lib/i18n/pdf";
import { fitImage } from "../image-size";
import { CONTENT_WIDTH, GRID, TYPE, WEIGHT, mm } from "../tokens";
import { paragraphs } from "../typography";
import type { PdfAuthor } from "../model";
import { bodyStyle, labelStyle, text, type DocTheme } from "./theme";

/**
 * Section : intertitre en majuscules espacées suivi de son contenu. `keep="all"` rend la
 * section insécable (tableaux, audiogramme : jamais coupés) ; `keep="first"` attache
 * l'intertitre à son premier bloc (texte long) : jamais d'intertitre orphelin en bas de page.
 * (`minPresenceAhead` de react-pdf ne suffit pas : il est ignoré dans certains cas.)
 */
export function Section({
  theme,
  title,
  children,
  keep = "all",
}: {
  theme: DocTheme;
  title: string;
  children: ReactNode;
  keep?: "all" | "first";
}) {
  const blocks = Children.toArray(children);
  if (keep === "all") {
    return (
      <View wrap={false} style={{ marginTop: mm(8) }}>
        <SectionTitle theme={theme} title={title} />
        {blocks}
      </View>
    );
  }
  return (
    <View style={{ marginTop: mm(8) }}>
      <View wrap={false}>
        <SectionTitle theme={theme} title={title} />
        {blocks[0]}
      </View>
      {blocks.slice(1)}
    </View>
  );
}

export function SectionTitle({ theme, title }: { theme: DocTheme; title: string }) {
  return (
    <Text
      style={{
        ...text(theme, TYPE.section, WEIGHT.semibold, theme.t.primary, 1.2),
        letterSpacing: 0.9,
        textTransform: "uppercase",
        marginBottom: mm(2),
      }}
    >
      {title}
    </Text>
  );
}

export interface KeyValue {
  label: string;
  value: string;
  strong?: boolean;
}

/** Tableau à deux colonnes libellé / valeur, lignes séparées par des filets fins. */
export function KeyValueTable({
  theme,
  rows,
  labelWidth = 52,
}: {
  theme: DocTheme;
  rows: KeyValue[];
  labelWidth?: number;
}) {
  if (rows.length === 0) return null;
  return (
    <View style={{ borderTopWidth: 0.5, borderTopColor: theme.t.hairline }}>
      {rows.map((r) => (
        <View
          key={r.label}
          wrap={false}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: mm(8),
            paddingVertical: mm(1),
            borderBottomWidth: 0.5,
            borderBottomColor: theme.t.hairline,
          }}
        >
          <Text style={{ ...labelStyle(theme), width: mm(labelWidth), paddingRight: mm(4) }}>{r.label}</Text>
          <Text
            style={{
              ...text(theme, TYPE.body, r.strong ? WEIGHT.semibold : WEIGHT.regular, theme.t.ink, 1.35),
              width: mm(CONTENT_WIDTH - labelWidth),
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Liste à puces sobres : petit carré orange aligné sur la première ligne. */
export function BulletList({ theme, items }: { theme: DocTheme; items: string[] }) {
  const lineHeight = TYPE.body * TYPE.bodyLeading;
  const square = mm(1.6);
  return (
    <View style={{ marginTop: mm(2) }}>
      {items.map((item, i) => (
        <View key={i} wrap={false} style={{ flexDirection: "row", marginTop: i === 0 ? 0 : mm(2), paddingLeft: mm(4) }}>
          <View style={{ width: mm(6), height: lineHeight, justifyContent: "center" }}>
            <View style={{ width: square, height: square, backgroundColor: theme.t.accent }} />
          </View>
          <Text style={{ ...bodyStyle(theme), width: mm(CONTENT_WIDTH - 10) }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** Paragraphes de texte courant (10 pt, interligne 1,45). */
export function paragraphBlocks(theme: DocTheme, value: string, spacing = 3): ReactNode[] {
  return paragraphs(value).map((p, i) => (
    <Text key={i} orphans={2} widows={2} style={{ ...bodyStyle(theme), marginTop: i === 0 ? 0 : mm(spacing) }}>
      {p}
    </Text>
  ));
}

export interface IdentityField {
  label: string;
  value: string;
}

/** Encadré d'identification (fond bleu à 5 %), grille de trois colonnes alignées. */
export function IdentityCard({ theme, fields }: { theme: DocTheme; fields: IdentityField[] }) {
  const filled = fields.filter((f) => f.value);
  if (filled.length === 0) return null;
  const rows: IdentityField[][] = [];
  for (let i = 0; i < filled.length; i += 3) rows.push(filled.slice(i, i + 3));
  const inner = CONTENT_WIDTH - 8;
  return (
    <View
      wrap={false}
      style={{
        backgroundColor: theme.t.tint,
        borderRadius: mm(1),
        paddingHorizontal: mm(4),
        paddingVertical: mm(4),
        marginTop: mm(4),
      }}
    >
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", marginTop: ri === 0 ? 0 : mm(3) }}>
          {row.map((f) => (
            <View key={f.label} style={{ width: mm(inner / 3), paddingRight: mm(4) }}>
              <Text style={labelStyle(theme)}>{f.label}</Text>
              <Text style={{ ...text(theme, TYPE.body, WEIGHT.semibold, theme.t.ink, 1.3), marginTop: mm(0.5) }}>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Formule de politesse et signature, jamais séparées. `lead` (dernier paragraphe du
 * document) leur est attaché pour que la signature ne se retrouve jamais seule sur une page.
 */
export function Signature({
  theme,
  closing,
  author,
  showSignature,
  lead,
}: {
  theme: DocTheme;
  closing: string;
  author: PdfAuthor;
  showSignature: boolean;
  lead?: ReactNode;
}) {
  const name = [author.firstName, author.lastName.toLocaleUpperCase("fr-FR")].filter(Boolean).join(" ");
  const image = showSignature && author.signature ? author.signature : null;
  const box = image ? fitImage(image, mm(50), mm(18)) : null;
  return (
    <View wrap={false}>
      {lead}
      <Text style={{ ...bodyStyle(theme), marginTop: mm(8) }}>{closing}</Text>
      <View
        style={{
          marginTop: mm(6),
          marginLeft: mm(GRID.rightColumn - GRID.marginX),
          width: mm(CONTENT_WIDTH - (GRID.rightColumn - GRID.marginX)),
        }}
      >
        {image && box ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={image} style={{ width: box.width, height: box.height, marginBottom: mm(2) }} />
        ) : null}
        {name ? <Text style={text(theme, TYPE.body, WEIGHT.semibold, theme.t.ink, 1.3)}>{name}</Text> : null}
        <Text style={text(theme, TYPE.small, WEIGHT.regular, theme.t.label, 1.35)}>
          {author.title || "Audioprothésiste D.E"}
        </Text>
        {author.rpps ? (
          <Text style={text(theme, TYPE.small, WEIGHT.regular, theme.t.label, 1.35)}>{pdfFr.rpps(author.rpps)}</Text>
        ) : null}
      </View>
    </View>
  );
}
