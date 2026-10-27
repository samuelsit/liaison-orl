import "server-only";
import { formatRecipientAddress, type AddressRecipient, type FormattedAddress } from "@/lib/postal/address";
import type { DocumentFontChoice } from "@/lib/schemas/organization";
import { measure } from "./fonts";
import { MM, TYPE } from "./tokens";
import { PINGEN_ZONES } from "./zones";

/** Largeur utile du bloc adresse : zone d'adresse moins 2 mm de marge de chaque côté. */
export const ADDRESS_TEXT_WIDTH_MM = PINGEN_ZONES.address.w - 2 * PINGEN_ZONES.addressPadding;

/** Adresse postale mise en forme et vérifiée avec la police et le corps réellement imprimés. */
export function postalAddress(recipient: AddressRecipient, font: DocumentFontChoice = "Inter"): FormattedAddress {
  return formatRecipientAddress(recipient, {
    measureMm: (line) => measure(line, font, 400, TYPE.address) / MM,
    maxWidthMm: ADDRESS_TEXT_WIDTH_MM,
  });
}
