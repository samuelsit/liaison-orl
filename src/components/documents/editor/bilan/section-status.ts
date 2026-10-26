import type { EditorSectionStatus } from "@/components/documents/editor/section";
import type { CompteRenduData } from "@/lib/schemas/document";

export type CrSectionId = "identity" | "bilan" | "patient" | "device" | "results" | "comments";

/** Champs du formulaire par section (erreurs de validation et suggestions de l'IA). */
export const CR_SECTION_FIELDS: Record<CrSectionId, readonly string[]> = {
  identity: ["patientId", "prescriberId", "patientBirthDate", "reportDate", "prescriptionDate"],
  bilan: ["attachmentId"],
  patient: ["degree", "ears", "degreeRule"],
  device: ["deviceType", "deviceBrand", "deviceBrandOther", "deviceModel", "pricePerDevice", "deviceClass", "rechargeable", "customEarmolds"],
  results: ["wearDuration", "wearHoursPerDay", "motivation", "handling"],
  comments: ["comments", "includeAnnex"],
};

export interface CrStatusInput {
  data: CompteRenduData;
  patient: { birthDate: string } | null;
  prescriber: object | null;
  errors: Record<string, string>;
  aiFields: readonly string[];
  bilan: { confirmed: boolean };
}

/**
 * État d'avancement de chaque section du compte rendu (pastille d'étape, navigateur
 * de sections) : erreur s'il reste une erreur de validation, complète si les champs
 * obligatoires (ou recommandés pour les sections sans obligation) sont remplis et
 * qu'aucune suggestion de l'IA n'attend de relecture.
 */
export function crSectionStatuses(input: CrStatusInput): Record<CrSectionId, EditorSectionStatus> {
  const { data: d, patient, prescriber, errors, aiFields, bilan } = input;
  const filled: Record<CrSectionId, boolean> = {
    identity: Boolean(patient && prescriber && patient.birthDate && d.reportDate),
    bilan: bilan.confirmed,
    patient: Boolean(d.degree && d.ears),
    device: Boolean(d.deviceType && d.deviceBrand && (d.deviceBrand !== "autre" || d.deviceBrandOther.trim()) && d.deviceClass),
    results: Boolean(d.wearDuration.trim() && d.wearHoursPerDay !== null && d.motivation && d.handling),
    comments: Boolean(d.comments.trim()),
  };
  const out = {} as Record<CrSectionId, EditorSectionStatus>;
  for (const id of Object.keys(CR_SECTION_FIELDS) as CrSectionId[]) {
    const fields = CR_SECTION_FIELDS[id];
    if (fields.some((f) => f in errors)) out[id] = "error";
    else if (filled[id] && !fields.some((f) => aiFields.includes(f))) out[id] = "complete";
    else out[id] = "incomplete";
  }
  return out;
}
