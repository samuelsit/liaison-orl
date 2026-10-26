import type { AdressageData, CompteRenduData, DocumentType } from "@/lib/schemas/document";

export interface ValidationInput {
  type: DocumentType;
  data: AdressageData | CompteRenduData;
  patient: { birthDate: string } | null;
  prescriber: { email: string; address: { line1: string; postalCode: string; city: string } } | null;
}

export interface ValidationReport {
  /** Champs bloquants (chemin → message). */
  errors: Record<string, string>;
  /** Champs recommandés non renseignés. */
  warnings: string[];
}

/** Règles de complétude avant validation d'un document. */
export function checkDocument(input: ValidationInput): ValidationReport {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  if (!input.patient) errors.patientId = "Choisissez le patient.";
  if (!input.prescriber) errors.prescriberId = "Choisissez le prescripteur destinataire.";
  if (input.type === "ADRESSAGE") {
    const d = input.data as AdressageData;
    if (!d.exams.conduits && !d.exams.bilan && !d.exams.autre) errors["exams"] = "Cochez au moins un examen.";
    if (d.exams.autre && !d.autreText.trim()) errors["autreText"] = "Précisez le motif « Autre ».";
    if (!d.date) errors.date = "Indiquez la date.";
  } else {
    const d = input.data as CompteRenduData;
    if (input.patient && !input.patient.birthDate) errors.patientBirthDate = "La date de naissance du patient est nécessaire au compte rendu.";
    if (!d.reportDate) errors.reportDate = "Indiquez la date du jour.";
    if (!d.degree) errors.degree = "Indiquez le degré de surdité.";
    if (!d.ears) errors.ears = "Indiquez l'oreille ou les oreilles appareillées.";
    if (!d.deviceType) errors.deviceType = "Choisissez le type d'aide auditive.";
    if (!d.deviceBrand) errors.deviceBrand = "Choisissez la marque.";
    if (d.deviceBrand === "autre" && !d.deviceBrandOther.trim()) errors.deviceBrandOther = "Précisez la marque.";
    if (!d.deviceClass) errors.deviceClass = "Indiquez la classe.";
    if (!d.deviceModel.trim()) warnings.push("Modèle");
    if (d.pricePerDevice === null) warnings.push("Prix par appareil");
    if (d.rechargeable === null) warnings.push("Rechargeable");
    if (d.customEarmolds === null) warnings.push("Embouts sur mesure");
    if (!d.prescriptionDate) warnings.push("Date d'ordonnance");
    if (!d.wearDuration.trim()) warnings.push("Durée de port moyen");
    if (d.wearHoursPerDay === null) warnings.push("Heures de port par jour");
    if (!d.motivation) warnings.push("Motivation");
    if (!d.handling) warnings.push("Acquisition de la manipulation");
    if (!d.comments.trim()) warnings.push("Commentaires");
  }
  return { errors, warnings };
}

export function isValid(report: ValidationReport) {
  return Object.keys(report.errors).length === 0;
}
