import { env } from "@/lib/env";

/** Adresse d'expédition technique (domaine vérifié chez Resend). */
export function fromAddress(): string {
  const e = env();
  if (e.EMAIL_FROM_ADDRESS) return e.EMAIL_FROM_ADDRESS;
  if (e.EMAIL_FROM_DOMAIN) return `ne-pas-repondre@${e.EMAIL_FROM_DOMAIN}`;
  return "ne-pas-repondre@demo.invalid";
}

/** « Nom affiché <adresse> » en neutralisant les caractères spéciaux. */
export function formatFrom(name: string): string {
  const clean = name.replace(/["<>\r\n]/g, "").trim();
  return clean ? `"${clean}" <${fromAddress()}>` : fromAddress();
}
