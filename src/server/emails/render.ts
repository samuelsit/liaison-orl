import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { appUrl } from "@/lib/env";
import type { OrganizationDoc } from "@/lib/db/types";
import type { EmailBrand } from "./layout";

export async function renderEmail(element: ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export function emailBrand(org: OrganizationDoc | null, footerExtra?: string): EmailBrand {
  const name = org?.brand.name ?? "";
  return {
    name,
    primary: org?.brand.colors.primary ?? "#1F2937",
    accent: org?.brand.colors.accent ?? "#1F2937",
    text: org?.brand.colors.text ?? "#1F2937",
    logoUrl: org?.brand.logo ? `${appUrl()}/api/marque/logo?o=${org._id}` : null,
    footer: [footerExtra, org?.legal.mentions].filter(Boolean).join(" · ") || name,
  };
}
