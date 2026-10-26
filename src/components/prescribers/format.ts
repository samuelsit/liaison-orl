import { formatPersonName } from "@/lib/text";
import { isAddressComplete } from "@/lib/schemas/common";
import type { PreferredChannel } from "@/lib/schemas/prescriber";

export function formatPrescriberName(p: { civility: string; firstName: string; lastName: string }): string {
  return `${p.civility} ${formatPersonName(p.firstName, p.lastName)}`.replace(/\s+/g, " ").trim();
}

export function prescriberWarnings(p: { email: string; address: Parameters<typeof isAddressComplete>[0] }) {
  return { noEmail: !p.email, noAddress: !isAddressComplete(p.address) };
}

export interface ChannelReadiness {
  /** Un e-mail est renseigné. */
  email: boolean;
  /** L'adresse postale est complète (adresse, code postal, ville, pays). */
  post: boolean;
  /** Le canal préféré permet d'envoyer avec ces coordonnées (« les deux » exige e-mail ET adresse). */
  preferredUsable: boolean;
  /** Canal à proposer en un clic quand le canal préféré est inutilisable, s'il en existe un. */
  suggestion: "email" | "courrier" | null;
}

/** État d'envoi d'une fiche prescripteur (formulaire, fiche, annuaire). */
export function channelReadiness(p: {
  email: string | null | undefined;
  address: Parameters<typeof isAddressComplete>[0];
  preferredChannel: PreferredChannel;
}): ChannelReadiness {
  const email = Boolean(p.email?.trim());
  const post = isAddressComplete(p.address);
  const preferredUsable = p.preferredChannel === "email" ? email : p.preferredChannel === "courrier" ? post : email && post;
  const suggestion = preferredUsable ? null : email ? "email" : post ? "courrier" : null;
  return { email, post, preferredUsable, suggestion };
}

/** Adresse postale en lignes (ligne 1, complément, code postal + ville, pays). */
export function addressLines(a: { line1: string; line2?: string; postalCode: string; city: string; country: string }): string[] {
  return [a.line1, a.line2 ?? "", `${a.postalCode} ${a.city}`.trim(), a.country].map((l) => l.trim()).filter(Boolean);
}

/** Bloc de coordonnées à copier (nom, cabinet, adresse, e-mail, téléphone). */
export function contactText(p: {
  civility: string;
  firstName: string;
  lastName: string;
  practiceName: string;
  address: { line1: string; line2?: string; postalCode: string; city: string; country: string };
  email: string;
  phone: string;
}): string {
  return [formatPrescriberName(p), p.practiceName, ...addressLines(p.address), p.email, p.phone].filter(Boolean).join("\n");
}
