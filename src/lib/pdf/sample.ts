import "server-only";
import { emptyAdressage, emptyCompteRendu } from "@/lib/documents/defaults";
import { todayIso } from "@/lib/dates";
import { sampleAudiometry } from "./fixtures";
import type { PdfBrand, PdfCentre, PdfModel } from "./model";

/** Données fictives pour l'aperçu de la marque (administration). */
export function sampleModel(
  type: "ADRESSAGE" | "COMPTE_RENDU",
  brand: PdfBrand,
  centre: PdfCentre,
  defaultSalutation: string,
  showSignature: boolean,
): PdfModel {
  const common = {
    brand,
    centre,
    author: { firstName: "Camille", lastName: "Exemple", title: "Audioprothésiste D.E", signature: null, rpps: "" },
    patient: { civility: "Mme", firstName: "Jeanne", lastName: "Exemple", birthDate: "1946-03-12" },
    prescriber: {
      civility: "Dr",
      firstName: "Antoine",
      lastName: "Modèle",
      salutation: "",
      practiceName: "Cabinet ORL",
      address: { line1: "1 rue de l'Exemple", line2: "", postalCode: "75001", city: "Paris", country: "FRANCE" },
    },
    showSignature,
    defaultSalutation,
    draft: false,
  };
  if (type === "ADRESSAGE") {
    return {
      ...common,
      type,
      data: {
        ...emptyAdressage(todayIso()),
        exams: { conduits: true, bilan: true, autre: true },
        autreText: "Exemple de motif : vertiges depuis trois semaines, merci de votre avis.",
      },
    };
  }
  return {
    ...common,
    type,
    audiometry: sampleAudiometry(),
    data: {
      ...emptyCompteRendu(todayIso()),
      degree: "moyenne",
      ears: "deux",
      deviceType: "ecouteur_deporte",
      deviceBrand: "signia",
      deviceModel: "Modèle exemple",
      pricePerDevice: 1450,
      deviceClass: "2",
      rechargeable: true,
      customEarmolds: false,
      wearDuration: "3 semaines",
      wearHoursPerDay: 11,
      motivation: "active",
      handling: "oui",
      comments:
        "Exemple de commentaire : appareillage bien accepté, gain tonal moyen de 22 dB, port régulier. Contrôle prévu à un mois.",
      includeAnnex: true,
    },
  };
}
