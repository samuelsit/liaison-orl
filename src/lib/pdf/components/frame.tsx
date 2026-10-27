import "server-only";
import { Image, Text, View } from "@react-pdf/renderer";
import { pdfFr } from "@/lib/i18n/pdf";
import { fitImage } from "../image-size";
import { measure } from "../fonts";
import { GRID, MM, PAGE, TYPE, WEIGHT, mm } from "../tokens";
import { PINGEN_ZONES, edgeZones, type Zone } from "../zones";
import type { PdfBrand, PdfCentre } from "../model";
import { text, type DocTheme } from "./theme";

/** Filet fin bleu avec un court segment orange en accent. */
export function AccentRule({ theme, width }: { theme: DocTheme; width: number }) {
  return (
    <View style={{ width: mm(width), height: 1.2, position: "relative" }}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0.35,
          width: mm(width),
          height: 0.5,
          backgroundColor: theme.t.primary,
        }}
      />
      <View
        style={{ position: "absolute", left: 0, top: 0, width: mm(8), height: 1.2, backgroundColor: theme.t.accent }}
      />
    </View>
  );
}

function centreLines(centre: PdfCentre): string[] {
  const a = centre.address;
  return [
    a.line1,
    a.line2,
    [a.postalCode, a.city].filter(Boolean).join(" "),
    centre.phone ? pdfFr.phone(centre.phone) : "",
    centre.email,
  ].filter(Boolean);
}

/**
 * En-tête de la page 1 : logo, centre et coordonnées, filet, type de document.
 * Tout tient dans la colonne de gauche (x 20 → 86 mm) : rien dans la zone
 * d'affranchissement (x ≥ 90 mm) ni dans le coin du DMC.
 */
export function DocumentHeader({
  theme,
  brand,
  centre,
  title,
}: {
  theme: DocTheme;
  brand: PdfBrand;
  centre: PdfCentre;
  title: string;
}) {
  const logo = brand.logo ? fitImage(brand.logo, mm(60), mm(13)) : null;
  return (
    <View style={{ position: "absolute", left: mm(GRID.marginX), top: mm(15), width: mm(GRID.headerWidth) }}>
      {brand.logo && logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={brand.logo} style={{ width: logo.width, height: logo.height }} />
      ) : (
        <Text style={text(theme, TYPE.title, WEIGHT.semibold, theme.t.primary, 1.1)}>{brand.name}</Text>
      )}
      <View style={{ marginTop: mm(4) }}>
        <Text style={text(theme, 9, WEIGHT.semibold, theme.t.primary, 1.25)}>{centre.displayName}</Text>
        {centreLines(centre).map((line, i) => (
          <Text key={i} style={text(theme, TYPE.small, WEIGHT.regular, theme.t.label, 1.25)}>
            {line}
          </Text>
        ))}
      </View>
      <View style={{ marginTop: mm(4) }}>
        <AccentRule theme={theme} width={GRID.headerWidth} />
      </View>
      <Text style={{ ...text(theme, TYPE.title, WEIGHT.semibold, theme.t.primary, 1.2), marginTop: mm(4) }}>
        {title}
      </Text>
    </View>
  );
}

const ADDRESS_LINE_MM = 4.2;

/** Bloc adresse postal (norme NF Z10-011) : en haut à gauche de la zone d'adresse Pingen, 2 mm de marge. */
export function AddressBlock({ theme, lines }: { theme: DocTheme; lines: string[] }) {
  const z = PINGEN_ZONES.address;
  const pad = PINGEN_ZONES.addressPadding;
  return (
    <View style={{ position: "absolute", left: mm(z.x + pad), top: mm(z.y + pad), width: mm(z.w - 2 * pad) }}>
      {lines.map((line, i) => (
        <View key={i} style={{ height: mm(ADDRESS_LINE_MM), justifyContent: "center" }}>
          <Text
            style={{
              fontFamily: theme.font,
              fontSize: TYPE.address,
              fontWeight: WEIGHT.regular,
              color: "#000000",
              lineHeight: 1,
            }}
          >
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Version e-mail : « À l'attention de » au même emplacement que l'adresse postale (mise en page identique). */
export function RecipientBlock({
  theme,
  name,
  practice,
  city,
}: {
  theme: DocTheme;
  name: string;
  practice: string;
  city: string;
}) {
  const z = PINGEN_ZONES.address;
  const pad = PINGEN_ZONES.addressPadding;
  if (!name) return null;
  return (
    <View style={{ position: "absolute", left: mm(z.x + pad), top: mm(z.y + pad), width: mm(z.w - 2 * pad) }}>
      <Text style={text(theme, TYPE.label, WEIGHT.medium, theme.t.label, 1.3)}>{pdfFr.attention}</Text>
      <Text style={{ ...text(theme, TYPE.body, WEIGHT.semibold, theme.t.ink, 1.35), marginTop: mm(1) }}>{name}</Text>
      {practice ? <Text style={text(theme, TYPE.body, WEIGHT.regular, theme.t.ink, 1.35)}>{practice}</Text> : null}
      {city ? <Text style={text(theme, TYPE.body, WEIGHT.regular, theme.t.ink, 1.35)}>{city}</Text> : null}
    </View>
  );
}

/** En-tête réduit des pages 2 et suivantes (à gauche : le coin haut droit est réservé au DMC). */
export function ContinuationHeader({
  theme,
  centreName,
  patient,
}: {
  theme: DocTheme;
  centreName: string;
  patient: string;
}) {
  return (
    <View
      fixed
      style={{ position: "absolute", left: mm(GRID.marginX), top: mm(16), width: mm(150) }}
      // Le type de react-pdf omet `totalPages` pour les vues ; la valeur est bien fournie.
      render={(props) => {
        const { pageNumber, totalPages } = props as { pageNumber: number; totalPages?: number };
        return pageNumber > 1 ? (
          <View>
            <Text style={text(theme, 9, WEIGHT.semibold, theme.t.primary, 1.25)}>{centreName}</Text>
            <Text style={text(theme, TYPE.small, WEIGHT.regular, theme.t.label, 1.25)}>
              {pdfFr.continuation(patient, pageNumber, totalPages ?? pageNumber)}
            </Text>
            <View style={{ marginTop: mm(2) }}>
              <AccentRule theme={theme} width={GRID.headerWidth} />
            </View>
          </View>
        ) : null;
      }}
    />
  );
}

const FOOTER_LINE_MM = (TYPE.footer * 1.35) / MM;
const FOOTER_TEXT_MM = PAGE.width - 2 * GRID.marginX - 16;

/** Hauteur du pied de page (mm) : les mentions légales longues l'agrandissent vers le haut. */
export function footerHeight(theme: DocTheme, legal: string): number {
  const legalLines = legal
    ? Math.max(1, Math.ceil(measure(legal, theme.font, 400, TYPE.footer) / mm(FOOTER_TEXT_MM)))
    : 0;
  return 2 + (legalLines + 1) * FOOTER_LINE_MM;
}

/**
 * Pied de page : filet, mentions légales, confidentialité et pagination ; bas du
 * texte à 10 mm du bord (hors de la zone bloquée). La pagination est un élément
 * distinct, sans interligne : react-pdf ne dessine pas un texte calculé (`render`) qui a un `lineHeight`.
 */
export function DocumentFooter({ theme, legal }: { theme: DocTheme; legal: string }) {
  const style = text(theme, TYPE.footer, WEIGHT.regular, theme.t.label, 1.35);
  const bottom = mm(PAGE.height - GRID.footerBottom);
  return (
    <>
      <View
        fixed
        style={{ position: "absolute", left: mm(GRID.marginX), bottom, width: mm(PAGE.width - 2 * GRID.marginX) }}
      >
        <View style={{ height: 0.5, backgroundColor: theme.t.hairline, marginBottom: mm(2) }} />
        <View style={{ width: mm(FOOTER_TEXT_MM) }}>
          {legal ? <Text style={style}>{legal}</Text> : null}
          <Text style={style}>{pdfFr.confidential}</Text>
        </View>
      </View>
      <Text
        fixed
        style={{
          fontFamily: theme.font,
          fontSize: TYPE.footer,
          fontWeight: WEIGHT.medium,
          color: theme.t.label,
          position: "absolute",
          right: mm(GRID.marginX),
          bottom: bottom + 1,
          width: mm(16),
          textAlign: "right",
        }}
        render={({ pageNumber, totalPages }) => pdfFr.pagination(pageNumber, totalPages ?? pageNumber)}
      />
    </>
  );
}

export function DraftWatermark({ theme }: { theme: DocTheme }) {
  return (
    <Text
      fixed
      style={{
        position: "absolute",
        left: 0,
        top: mm(140),
        width: mm(PAGE.width),
        textAlign: "center",
        fontFamily: theme.font,
        fontWeight: WEIGHT.semibold,
        fontSize: 64,
        color: theme.t.ink,
        opacity: 0.05,
        transform: "rotate(-30deg)",
      }}
    >
      {pdfFr.draft}
    </Text>
  );
}

function ZoneBox({ zone, color, label, theme }: { zone: Zone; color: string; label?: string; theme: DocTheme }) {
  return (
    <View style={{ position: "absolute", left: mm(zone.x), top: mm(zone.y), width: mm(zone.w), height: mm(zone.h) }}>
      <View
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: color, opacity: 0.18 }}
      />
      <View
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderWidth: 0.6, borderColor: color }}
      />
      {label ? (
        <Text style={{ position: "absolute", left: 2, bottom: 1, fontFamily: theme.font, fontSize: 6, color }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Superposition de contrôle des zones Pingen (?debug=pingen) : bords et DMC sur chaque page, fenêtre en page 1. */
export function PingenDebugOverlay({ theme }: { theme: DocTheme }) {
  return (
    <>
      <View fixed style={{ position: "absolute", left: 0, top: 0, width: mm(PAGE.width), height: mm(PAGE.height) }}>
        {edgeZones().map((z, i) => (
          <ZoneBox key={i} zone={z} color="#D32F2F" theme={theme} />
        ))}
        <ZoneBox zone={PINGEN_ZONES.dmcGuard} color="#7B1FA2" theme={theme} />
        <ZoneBox zone={PINGEN_ZONES.dmc} color="#7B1FA2" label={pdfFr.debug.dmc} theme={theme} />
      </View>
      <ZoneBox zone={PINGEN_ZONES.postage} color="#EF6C00" label={pdfFr.debug.postage} theme={theme} />
      <ZoneBox zone={PINGEN_ZONES.address} color="#2E7D32" label={pdfFr.debug.address} theme={theme} />
    </>
  );
}
