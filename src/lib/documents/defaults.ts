import type { AdressageData, CompteRenduData, DocumentData, DocumentType } from "@/lib/schemas/document";
import { DEVICE_BRANDS, DEVICE_CLASSES, DEVICE_TYPES } from "@/lib/schemas/document";
import type { LearnedDefaults } from "@/lib/schemas/user";

/** Champs du compte rendu dont la valeur est apprise des choix fréquents de l'utilisateur. */
export const LEARNED_FIELDS = ["deviceType", "deviceBrand", "deviceClass", "rechargeable", "customEarmolds"] as const;
export type LearnedField = (typeof LEARNED_FIELDS)[number];

export function emptyAdressage(today: string): AdressageData {
  return {
    schemaVersion: 1,
    date: today,
    salutation: "",
    exams: { conduits: false, bilan: false, autre: false },
    autreText: "",
    motifNotes: "",
  };
}

export function emptyCompteRendu(today: string): CompteRenduData {
  return {
    schemaVersion: 1,
    reportDate: today,
    prescriptionDate: "",
    degree: null,
    ears: null,
    deviceType: null,
    deviceBrand: null,
    deviceBrandOther: "",
    deviceModel: "",
    pricePerDevice: null,
    deviceClass: null,
    rechargeable: null,
    customEarmolds: null,
    wearDuration: "",
    wearHoursPerDay: null,
    motivation: null,
    handling: null,
    comments: "",
    attachmentId: null,
    degreeRule: null,
    includeAnnex: true,
  };
}

/** Valeur la plus fréquente (au moins 2 occurrences) pour un champ appris. */
export function mostFrequent(learned: LearnedDefaults | undefined, field: LearnedField): string | null {
  const counts = learned?.[field];
  if (!counts) return null;
  let best: string | null = null;
  let bestCount = 1;
  for (const [value, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Applique les valeurs mémorisées à un compte rendu vierge. */
export function applyLearnedDefaults(data: CompteRenduData, learned: LearnedDefaults | undefined): CompteRenduData {
  const next = { ...data };
  const type = mostFrequent(learned, "deviceType");
  if (type && (DEVICE_TYPES as readonly string[]).includes(type)) next.deviceType = type as CompteRenduData["deviceType"];
  const brand = mostFrequent(learned, "deviceBrand");
  if (brand && (DEVICE_BRANDS as readonly string[]).includes(brand) && brand !== "autre") next.deviceBrand = brand as CompteRenduData["deviceBrand"];
  const cls = mostFrequent(learned, "deviceClass");
  if (cls && (DEVICE_CLASSES as readonly string[]).includes(cls)) next.deviceClass = cls as CompteRenduData["deviceClass"];
  const recharge = mostFrequent(learned, "rechargeable");
  if (recharge === "true" || recharge === "false") next.rechargeable = recharge === "true";
  const molds = mostFrequent(learned, "customEarmolds");
  if (molds === "true" || molds === "false") next.customEarmolds = molds === "true";
  return next;
}

/** Incrémente les compteurs à partir d'un compte rendu validé. */
export function learnFrom(learned: LearnedDefaults | undefined, data: CompteRenduData): LearnedDefaults {
  const next: LearnedDefaults = structuredClone(learned ?? {});
  for (const field of LEARNED_FIELDS) {
    const value = data[field];
    if (value === null || value === undefined) continue;
    const key = String(value);
    next[field] = { ...(next[field] ?? {}), [key]: ((next[field] ?? {})[key] ?? 0) + 1 };
  }
  return next;
}

export function defaultDataFor(type: DocumentType, today: string, learned?: LearnedDefaults): DocumentData {
  return type === "ADRESSAGE" ? emptyAdressage(today) : applyLearnedDefaults(emptyCompteRendu(today), learned);
}
