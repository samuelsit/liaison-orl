import { env } from "@/lib/env";

const ADDRESS_RE = /^[^\s@<>"(),;:\\[\]]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const DEMO_ADDRESS = "ne-pas-repondre@demo.invalid";

/** Adresse seule, depuis une saisie tolérante : « Nom <a@b.fr> », « mailto:a@b.fr », espaces. */
function cleanAddress(raw: string): string {
  const bracketed = /<([^>]*)>/.exec(raw);
  return (bracketed ? bracketed[1] : raw).trim().replace(/^mailto:/i, "");
}

/** Domaine seul, depuis « https://mail.exemple.fr/ », « @mail.exemple.fr », « contact@mail.exemple.fr »… */
function cleanDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^.*@/, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");
}

/** Adresse d'expédition technique (domaine vérifié chez Resend) et problème de configuration éventuel. */
export function senderAddress(): { address: string; configured: boolean; issue: string | null } {
  const e = env();
  if (e.EMAIL_FROM_ADDRESS) {
    const address = cleanAddress(e.EMAIL_FROM_ADDRESS);
    return ADDRESS_RE.test(address)
      ? { address, configured: true, issue: null }
      : { address, configured: true, issue: `EMAIL_FROM_ADDRESS invalide (« ${e.EMAIL_FROM_ADDRESS} ») : indiquez une adresse seule, par exemple ne-pas-repondre@mail.votredomaine.fr.` };
  }
  if (e.EMAIL_FROM_DOMAIN) {
    const address = `ne-pas-repondre@${cleanDomain(e.EMAIL_FROM_DOMAIN)}`;
    return ADDRESS_RE.test(address)
      ? { address, configured: true, issue: null }
      : { address, configured: true, issue: `EMAIL_FROM_DOMAIN invalide (« ${e.EMAIL_FROM_DOMAIN} ») : indiquez le domaine vérifié chez Resend, par exemple mail.votredomaine.fr.` };
  }
  return { address: DEMO_ADDRESS, configured: false, issue: "EMAIL_FROM_DOMAIN manquant : indiquez le domaine vérifié chez Resend (par exemple mail.votredomaine.fr)." };
}

export function fromAddress(): string {
  return senderAddress().address;
}

/** « Nom affiché <adresse> » en neutralisant les caractères qui cassent l'en-tête From. */
export function formatFrom(name: string): string {
  const clean = name
    .replace(/[\u0000-\u001f\u007f"<>\\@]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? `"${clean}" <${fromAddress()}>` : fromAddress();
}
