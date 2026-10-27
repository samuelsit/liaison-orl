import type { BrandColors, DocumentFontChoice } from "@/lib/schemas/organization";
import type { PostalAddress } from "@/lib/schemas/common";
import type { AdressageData, CompteRenduData } from "@/lib/schemas/document";
import type { Audiometry } from "@/lib/schemas/audiometry";

export interface PdfBrand {
  name: string;
  logo: string | null;
  colors: BrandColors;
  font: DocumentFontChoice;
  /** Mentions légales imprimées en pied de page (raison sociale, mentions). */
  legal: string;
}

export interface PdfCentre {
  name: string;
  displayName: string;
  address: PostalAddress;
  phone: string;
  email: string;
  senderAddress: PostalAddress | null;
}

export interface PdfPerson {
  civility: string;
  firstName: string;
  lastName: string;
}

export interface PdfPatient extends PdfPerson {
  birthDate: string;
}

export interface PdfPrescriber extends PdfPerson {
  salutation: string;
  practiceName: string;
  address: PostalAddress;
}

export interface PdfAuthor {
  firstName: string;
  lastName: string;
  title: string;
  signature: string | null;
  /** Numéro RPPS de l'audioprothésiste (facultatif). */
  rpps?: string;
}

interface Common {
  brand: PdfBrand;
  centre: PdfCentre;
  author: PdfAuthor;
  patient: PdfPatient | null;
  prescriber: PdfPrescriber | null;
  showSignature: boolean;
  defaultSalutation: string;
  /** Mention « Brouillon » en filigrane. */
  draft: boolean;
}

export type PdfModel =
  | (Common & { type: "ADRESSAGE"; data: AdressageData })
  | (Common & { type: "COMPTE_RENDU"; data: CompteRenduData; audiometry: Audiometry | null });

/** standard = envoi par e-mail (bloc « À l'attention de ») ; postal = bloc adresse dans la fenêtre Pingen. */
export type PdfVariant = "standard" | "postal";

export interface PdfRenderOptions {
  /** Superpose les zones Pingen (bord bloqué, affranchissement, adresse, DMC). */
  debugZones?: boolean;
}
