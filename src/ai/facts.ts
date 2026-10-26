import { ageAt } from "@/lib/dates";
import { prostheticGain, suggestDegree } from "@/lib/audiology/calculations";
import type { Audiometry } from "@/lib/schemas/audiometry";
import type { CompteRenduData } from "@/lib/schemas/document";
import { docFr } from "@/lib/i18n/documents";
import type { CommentFacts } from "./types";

const O = docFr.options;
const EARS_LABEL = { droite: "droite", gauche: "gauche", deux: "les deux" } as const;

/** Faits objectifs (aucune donnée d'identité) servant à rédiger le commentaire. */
export function buildCommentFacts(
  d: CompteRenduData,
  audiometry: Audiometry | null,
  patient: { civility: "Mme" | "M."; birthDate: string } | null,
  userNotes: string,
): CommentFacts {
  const s = audiometry ? suggestDegree(audiometry) : null;
  const g = audiometry ? prostheticGain(audiometry) : null;
  return {
    civility: patient?.civility ?? null,
    age: patient?.birthDate ? ageAt(patient.birthDate, d.reportDate) : null,
    ears: d.ears ? EARS_LABEL[d.ears] : null,
    degree: d.degree ? O.degree[d.degree] : null,
    deviceType: d.deviceType ? O.deviceType[d.deviceType] : null,
    brand: d.deviceBrand === "autre" ? d.deviceBrandOther || null : d.deviceBrand ? O.deviceBrand[d.deviceBrand] : null,
    model: d.deviceModel || null,
    deviceClass: d.deviceClass ? O.deviceClass[d.deviceClass] : null,
    rechargeable: d.rechargeable,
    customEarmolds: d.customEarmolds,
    wearDuration: d.wearDuration || null,
    hoursPerDay: d.wearHoursPerDay,
    motivation: d.motivation ? O.motivation[d.motivation] : null,
    handling: d.handling ? O.handling[d.handling] : null,
    ptaRight: s?.right.value ?? null,
    ptaLeft: s?.left.value ?? null,
    globalLoss: s?.global ?? null,
    biapLabel: s?.globalClass?.label ?? null,
    meanGain: g?.mean ?? null,
    srtUnaided: g?.speech.srtUnaided ?? null,
    srtAided: g?.speech.srtAided ?? null,
    srtGain: g?.speech.srtGain ?? null,
    scoreUnaided: g?.speech.scoreUnaided ?? null,
    scoreAided: g?.speech.scoreAided ?? null,
    scoreGain: g?.speech.scoreGain ?? null,
    noiseTest: audiometry?.noise?.testName ?? null,
    noiseSnrGain: g?.noise?.snrGain ?? null,
    noiseScoreGain: g?.noise?.scoreGain ?? null,
    userNotes,
  };
}

const yn = (v: boolean | null) => (v === null ? null : v ? "oui" : "non");
const num = (v: number | null, unit: string) => (v === null ? null : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${unit}`);

/** Liste lisible des faits, transmise au modèle (uniquement les valeurs disponibles). */
export function factsToText(f: CommentFacts): string {
  const rows: [string, string | null][] = [
    ["Sexe (accord grammatical)", f.civility === "Mme" ? "féminin" : f.civility === "M." ? "masculin" : null],
    ["Âge", f.age === null ? null : `${f.age} ans`],
    ["Oreille(s) appareillée(s)", f.ears],
    ["Degré de surdité retenu", f.degree],
    ["Classification BIAP (perte globale)", f.biapLabel],
    ["Perte moyenne OD", num(f.ptaRight, "dB")],
    ["Perte moyenne OG", num(f.ptaLeft, "dB")],
    ["Type d'aide auditive", f.deviceType],
    ["Marque / modèle", [f.brand, f.model].filter(Boolean).join(" ") || null],
    ["Classe", f.deviceClass],
    ["Rechargeable", yn(f.rechargeable)],
    ["Embouts sur mesure", yn(f.customEarmolds)],
    ["Durée de port moyen", f.wearDuration],
    ["Heures de port par jour", num(f.hoursPerDay, "h")],
    ["Motivation", f.motivation],
    ["Manipulation acquise", f.handling],
    ["Gain tonal moyen en champ libre (500-4000 Hz)", num(f.meanGain, "dB")],
    ["Seuil d'intelligibilité sans / avec appareils", f.srtUnaided !== null || f.srtAided !== null ? `${num(f.srtUnaided, "dB") ?? "—"} / ${num(f.srtAided, "dB") ?? "—"}` : null],
    ["Gain sur le seuil d'intelligibilité", num(f.srtGain, "dB")],
    ["Intelligibilité maximale sans / avec appareils", f.scoreUnaided !== null || f.scoreAided !== null ? `${num(f.scoreUnaided, "%") ?? "—"} / ${num(f.scoreAided, "%") ?? "—"}` : null],
    ["Gain en intelligibilité maximale", num(f.scoreGain, "points")],
    ["Test dans le bruit", f.noiseTest],
    ["Gain en rapport signal/bruit", num(f.noiseSnrGain, "dB")],
    ["Gain de score dans le bruit", num(f.noiseScoreGain, "points")],
    ["Notes de l'audioprothésiste", f.userNotes.trim() || null],
  ];
  return rows
    .filter((r): r is [string, string] => Boolean(r[1]))
    .map(([k, v]) => `- ${k} : ${v}`)
    .join("\n");
}
