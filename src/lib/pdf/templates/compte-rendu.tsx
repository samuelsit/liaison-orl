import "server-only";
import { Text, View } from "@react-pdf/renderer";
import { formatIsoDate } from "@/lib/dates";
import { pdfFr } from "@/lib/i18n/pdf";
import { prostheticGain, suggestDegree } from "@/lib/audiology/calculations";
import type { Audiometry } from "@/lib/schemas/audiometry";
import type { CompteRenduData } from "@/lib/schemas/document";
import { capitalizeName, upperName } from "@/lib/text";
import {
  IdentityCard,
  KeyValueTable,
  Section,
  SectionTitle,
  paragraphBlocks,
  type KeyValue,
} from "../components/blocks";
import { Audiogram, GainTable, audiogramSeries } from "../components/audiology";
import { bodyStyle } from "../components/theme";
import { WEIGHT, mm } from "../tokens";
import { typo } from "../typography";
import type { PdfModel, PdfRenderOptions, PdfVariant } from "../model";
import { LetterPage, longDate, personLabel } from "./letter";

type CrModel = Extract<PdfModel, { type: "COMPTE_RENDU" }>;

const C = pdfFr.compteRendu;
const nf = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const db = (v: number) => `${nf(v)} dB`;
const pct = (v: number) => `${nf(v)} %`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${nf(Math.abs(v))}`;

function price(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "";
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v).replace(/[  ]/g, " ")} €`;
}

const yesNo = (v: boolean | null) => (v === null ? "" : v ? C.equipment.yes : C.equipment.no);
const rows = (list: (KeyValue | null)[]): KeyValue[] => list.filter((r): r is KeyValue => Boolean(r && r.value));

/** Perte moyenne BIAP par oreille, puis globale si les deux oreilles sont mesurées. */
function ptaLines(a: Audiometry | null): string[] {
  if (!a) return [];
  const s = suggestDegree(a);
  const ears = [
    s.right.value !== null ? `OD ${db(s.right.value)}` : "",
    s.left.value !== null ? `OG ${db(s.left.value)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const global = s.global !== null && s.right.value !== null && s.left.value !== null ? `globale ${db(s.global)}` : "";
  return [ears, global].filter(Boolean);
}

function speechRows(a: Audiometry): KeyValue[] {
  const g = prostheticGain(a);
  const T = C.gainTable;
  const s = g.speech;
  const srt =
    s.srtUnaided !== null && s.srtAided !== null
      ? `${db(s.srtUnaided)} sans appareil → ${db(s.srtAided)} avec${s.srtGain !== null ? ` (gain de ${db(s.srtGain)})` : ""}`
      : "";
  const score =
    s.scoreUnaided !== null && s.scoreAided !== null
      ? `${pct(s.scoreUnaided)} sans appareil → ${pct(s.scoreAided)} avec${s.scoreGain !== null ? ` (${signed(s.scoreGain)} points)` : ""}`
      : "";
  const noise = g.noise
    ? [
        g.noise.snrGain !== null ? `gain de RSB ${db(g.noise.snrGain)}` : "",
        g.noise.scoreGain !== null ? `${signed(g.noise.scoreGain)} points` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  return rows([
    { label: T.srt, value: srt },
    { label: T.maxScore, value: score },
    { label: T.noise(a.noise?.testName ?? null), value: noise },
  ]);
}

function hasMeasures(a: Audiometry | null): a is Audiometry {
  return Boolean(a && audiogramSeries(a).length > 0);
}

/** Compte rendu d'appareillage : identification, bilan, gain, équipement, suivi, commentaire. */
export function CompteRenduPage({
  model,
  variant,
  options,
}: {
  model: CrModel;
  variant: PdfVariant;
  options: PdfRenderOptions;
}) {
  const d: CompteRenduData = model.data;
  const { patient, prescriber } = model;
  const audiometry = d.includeAnnex && hasMeasures(model.audiometry) ? model.audiometry : null;
  const gain = audiometry ? prostheticGain(audiometry) : null;
  const speech = audiometry ? speechRows(audiometry) : [];

  const audiology = rows([
    { label: C.audiology.degree, value: d.degree ? C.audiology.degreeValues[d.degree] : "", strong: true },
    { label: C.audiology.ears, value: d.ears ? C.audiology.earsValues[d.ears] : "" },
    { label: C.audiology.pta, value: ptaLines(audiometry).join("\n") },
  ]);
  const brandLabel =
    d.deviceBrand === "autre" ? typo(d.deviceBrandOther) : d.deviceBrand ? C.equipment.brandValues[d.deviceBrand] : "";
  const equipment = rows([
    { label: C.equipment.type, value: d.deviceType ? C.equipment.typeValues[d.deviceType] : "" },
    { label: C.equipment.brand, value: brandLabel },
    { label: C.equipment.model, value: typo(d.deviceModel) },
    { label: C.equipment.class, value: d.deviceClass ? C.equipment.classValues[d.deviceClass] : "" },
    { label: C.equipment.rechargeable, value: yesNo(d.rechargeable) },
    { label: C.equipment.earmolds, value: yesNo(d.customEarmolds) },
    { label: C.equipment.price, value: price(d.pricePerDevice) },
  ]);
  const followUp = rows([
    { label: C.followUp.duration, value: typo(d.wearDuration) },
    { label: C.followUp.hours, value: d.wearHoursPerDay === null ? "" : C.followUp.hoursValue(nf(d.wearHoursPerDay)) },
    { label: C.followUp.motivation, value: d.motivation ? C.followUp.motivationValues[d.motivation] : "" },
    { label: C.followUp.handling, value: d.handling ? C.followUp.handlingValues[d.handling] : "" },
  ]);
  const comments = typo(d.comments.trim());
  const I = C.identity;

  return (
    <LetterPage model={model} variant={variant} options={options}>
      {(theme) => {
        // Commentaire : intertitre attaché au premier paragraphe, dernier paragraphe attaché à la signature.
        const paras = comments ? paragraphBlocks(theme, comments) : [];
        const commentTitle = <SectionTitle theme={theme} title={C.sections.comments} />;
        const tail =
          paras.length === 1 ? (
            <View style={{ marginTop: mm(8) }}>
              {commentTitle}
              {paras[0]}
            </View>
          ) : paras.length > 1 ? (
            <View style={{ marginTop: mm(3) }}>{paras.at(-1)}</View>
          ) : undefined;
        return {
          tail,
          body: (
            <>
              <Text style={bodyStyle(theme)}>
                {C.intro(personLabel(patient), d.prescriptionDate ? longDate(d.prescriptionDate) : "")}
              </Text>
              <IdentityCard
                theme={theme}
                fields={[
                  { label: I.lastName, value: patient ? typo(upperName(patient.lastName)) : "" },
                  { label: I.firstName, value: patient ? typo(capitalizeName(patient.firstName)) : "" },
                  { label: I.birthDate, value: patient?.birthDate ? formatIsoDate(patient.birthDate) : "" },
                  { label: I.prescriptionDate, value: d.prescriptionDate ? formatIsoDate(d.prescriptionDate) : "" },
                  { label: I.prescriber, value: personLabel(prescriber) },
                ]}
              />
              {audiology.length || audiometry ? (
                <Section theme={theme} title={C.sections.audiology}>
                  {audiometry ? (
                    <Audiogram theme={theme} audiometry={audiometry} facts={audiology} />
                  ) : (
                    <KeyValueTable theme={theme} rows={audiology} />
                  )}
                </Section>
              ) : null}
              {gain && (gain.perFrequency.length || speech.length) ? (
                <Section theme={theme} title={C.sections.gain}>
                  <GainTable theme={theme} gain={gain} />
                  {speech.length ? (
                    <>
                      <Text
                        style={{
                          ...bodyStyle(theme),
                          fontWeight: WEIGHT.semibold,
                          marginTop: gain.perFrequency.length ? mm(6) : 0,
                          marginBottom: mm(2),
                        }}
                      >
                        {C.gainTable.speech}
                      </Text>
                      <KeyValueTable theme={theme} rows={speech} />
                    </>
                  ) : null}
                </Section>
              ) : null}
              {equipment.length ? (
                <Section theme={theme} title={C.sections.equipment}>
                  <KeyValueTable theme={theme} rows={equipment} />
                </Section>
              ) : null}
              {followUp.length ? (
                <Section theme={theme} title={C.sections.followUp}>
                  <KeyValueTable theme={theme} rows={followUp} />
                </Section>
              ) : null}
              {paras.length > 1 ? (
                <Section theme={theme} title={C.sections.comments} keep="first">
                  {paras.slice(0, -1)}
                </Section>
              ) : null}
            </>
          ),
        };
      }}
    </LetterPage>
  );
}
