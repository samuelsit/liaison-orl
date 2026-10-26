import type { BrandColors, FontChoice } from "@/lib/schemas/organization";
import type { PostalAddress } from "@/lib/schemas/common";
import type { AdressageData, CompteRenduData } from "@/lib/schemas/document";
import type { Audiometry } from "@/lib/schemas/audiometry";

export interface PdfBrand {
  name: string;
  slogan: string;
  logo: string | null;
  colors: BrandColors;
  font: FontChoice;
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
}

interface Common {
  brand: PdfBrand;
  centre: PdfCentre;
  author: PdfAuthor;
  patient: PdfPatient | null;
  prescriber: PdfPrescriber | null;
  showSignature: boolean;
  defaultSalutation: string;
  /** Mention « Aperçu — brouillon » en filigrane. */
  draft: boolean;
}

export type PdfModel =
  | (Common & { type: "ADRESSAGE"; data: AdressageData })
  | (Common & { type: "COMPTE_RENDU"; data: CompteRenduData; audiometry: Audiometry | null });

export type PdfVariant = "standard" | "postal";
