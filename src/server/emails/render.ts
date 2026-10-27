import "server-only";
import { render } from "@react-email/render";
import { appUrl } from "@/lib/env";
import { legalLine, primaryFillForDark, primaryForDark } from "@/lib/brand";
import type { CentreDoc, OrganizationDoc } from "@/lib/db/types";
import { documentTokens } from "@/lib/pdf/tokens";
import { imageSize } from "@/lib/pdf/image-size";
import type { EmailBrand, EmailContent } from "./layout";

/** HTML et texte brut d'un e-mail (le texte brut est écrit à la main, pas converti). */
export async function renderEmail(content: EmailContent): Promise<{ html: string; text: string }> {
  return { html: await render(content.element), text: content.text };
}

const LOGO_HEIGHT = 44;

/**
 * Marque des e-mails, entièrement issue de la configuration de l'organisation (et du
 * centre expéditeur s'il est connu) : changer la configuration suffit à tout rebrander.
 */
export function emailBrand(
  org: Pick<OrganizationDoc, "_id" | "brand" | "legal"> | null,
  centre?: { displayName: string; centre: Pick<CentreDoc, "address" | "phone" | "email"> } | null,
): EmailBrand {
  const colors = org?.brand.colors ?? { primary: "#1F3F7A", accent: "#E8632B", text: "#1A1F2B" };
  const t = documentTokens(colors);
  const size = org?.brand.logo ? imageSize(org.brand.logo) : null;
  const logoWidth = size ? Math.min(200, Math.round((LOGO_HEIGHT * size.width) / size.height)) : 0;
  const a = centre?.centre.address;
  return {
    name: org?.brand.name ?? "",
    logoUrl: org?.brand.logo ? `${appUrl()}/api/marque/logo?o=${org._id}` : null,
    logoWidth,
    logoHeight: size ? Math.round((logoWidth * size.height) / size.width) : LOGO_HEIGHT,
    colors: {
      primary: t.primary,
      accent: t.accent,
      ink: t.ink,
      label: t.label,
      hairline: t.hairline,
      tint: t.tint,
      primaryDark: primaryForDark(t.primary),
      buttonDark: primaryFillForDark(t.primary),
    },
    footer: {
      sender: centre?.displayName ?? org?.brand.name ?? "",
      lines: centre
        ? [
            [a?.line1, a?.line2, [a?.postalCode, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
            [centre.centre.phone ? `Tél. ${centre.centre.phone}` : "", centre.centre.email].filter(Boolean).join(" · "),
          ].filter(Boolean)
        : [],
      legal: org ? legalLine(org.legal) : "",
    },
  };
}
