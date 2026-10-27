import "server-only";
import { Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { formatIsoDate, formatIsoDateLong } from "@/lib/dates";
import { pdfFr } from "@/lib/i18n/pdf";
import { capitalizeName, formatPersonName } from "@/lib/text";
import { postalAddress } from "../address";
import { Signature } from "../components/blocks";
import {
  AddressBlock,
  ContinuationHeader,
  DocumentFooter,
  DocumentHeader,
  DraftWatermark,
  PingenDebugOverlay,
  RecipientBlock,
  footerHeight,
} from "../components/frame";
import { bodyStyle, text, themeFor, type DocTheme } from "../components/theme";
import { GRID, PAGE, TYPE, WEIGHT, mm } from "../tokens";
import { typo } from "../typography";
import type { PdfModel, PdfPerson, PdfRenderOptions, PdfVariant } from "../model";

/** « Mme Jeanne DUPONT ». */
export function personLabel(p: PdfPerson | null): string {
  return p ? typo([p.civility, formatPersonName(p.firstName, p.lastName)].filter(Boolean).join(" ")) : "";
}

/** « 1er octobre 2026 », « 27 octobre 2026 ». */
export function longDate(iso: string): string {
  return formatIsoDateLong(iso).replace(/^1 /, "1er ");
}

export function salutationFor(model: PdfModel): string {
  const fromDoc = model.type === "ADRESSAGE" ? model.data.salutation : "";
  return typo((fromDoc || model.prescriber?.salutation || model.defaultSalutation || "Cher(e) Docteur").trim());
}

function documentDate(model: PdfModel): string {
  return model.type === "ADRESSAGE" ? model.data.date : model.data.reportDate;
}

/**
 * Page de courrier commune aux deux documents.
 * Page 1 : en-tête à gauche, destinataire dans la zone d'adresse, corps à partir de y = 96 mm.
 * Pages suivantes : en-tête réduit ; pied de page et pagination sur toutes les pages.
 */
export function LetterPage({
  model,
  variant,
  options,
  children,
}: {
  model: PdfModel;
  variant: PdfVariant;
  options: PdfRenderOptions;
  /** Corps du document ; `tail` est attaché à la signature (jamais seule sur une page). */
  children: (theme: DocTheme) => { body: ReactNode; tail?: ReactNode };
}) {
  const theme = themeFor(model.brand);
  const content = children(theme);
  const { brand, centre, patient, prescriber } = model;
  const patientName = personLabel(patient);
  const birthDate = patient?.birthDate ? formatIsoDate(patient.birthDate) : "";
  const subject = pdfFr.subject(model.type, patientName, patient?.civility ?? "", birthDate);
  const date = documentDate(model);
  const place = date ? pdfFr.place(centre.address.city, longDate(date)) : "";
  const salutation = salutationFor(model);
  const paddingBottom = PAGE.height - GRID.footerBottom + footerHeight(theme, brand.legal) + GRID.footerGap;
  const postalLines =
    variant === "postal" && prescriber
      ? postalAddress(
          {
            civility: prescriber.civility,
            firstName: prescriber.firstName,
            lastName: prescriber.lastName,
            practiceName: prescriber.practiceName,
            address: prescriber.address,
          },
          brand.font,
        ).lines
      : [];

  return (
    <Page
      size="A4"
      style={{
        // Pas d'interligne au niveau de la page : hérité par la pagination calculée, il l'empêche de s'afficher.
        fontFamily: theme.font,
        fontSize: TYPE.body,
        color: theme.t.ink,
        paddingTop: mm(GRID.contentTop),
        paddingBottom: mm(paddingBottom),
        paddingLeft: mm(GRID.marginX),
        paddingRight: mm(GRID.marginX),
      }}
    >
      {options.debugZones ? <PingenDebugOverlay theme={theme} /> : null}
      <DocumentHeader theme={theme} brand={brand} centre={centre} title={pdfFr.titles[model.type]} />
      {variant === "postal" ? (
        <AddressBlock theme={theme} lines={postalLines} />
      ) : (
        <RecipientBlock
          theme={theme}
          name={personLabel(prescriber)}
          practice={typo(prescriber?.practiceName ?? "")}
          city={capitalizeName(prescriber?.address.city ?? "")}
        />
      )}
      <ContinuationHeader theme={theme} centreName={centre.displayName} patient={patientName} />
      <DocumentFooter theme={theme} legal={brand.legal} />

      <View style={{ height: mm(GRID.bodyTop - GRID.contentTop) }} />
      {place ? <Text style={text(theme, TYPE.body, WEIGHT.regular, theme.t.ink, 1.3)}>{place}</Text> : null}
      <Text style={{ ...text(theme, TYPE.body, WEIGHT.semibold, theme.t.ink, 1.4), marginTop: mm(4) }}>
        {pdfFr.objectLabel} {subject}
      </Text>
      <Text style={{ ...bodyStyle(theme), marginTop: mm(8) }}>{`${salutation},`}</Text>
      <View style={{ marginTop: mm(4) }}>{content.body}</View>
      <Signature
        theme={theme}
        closing={pdfFr.closing(salutation)}
        author={model.author}
        showSignature={model.showSignature}
        lead={content.tail}
      />
      {model.draft ? <DraftWatermark theme={theme} /> : null}
    </Page>
  );
}
