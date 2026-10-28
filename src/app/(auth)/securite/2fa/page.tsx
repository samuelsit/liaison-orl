import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { requireUser } from "@/lib/auth/session";
import { fr } from "@/lib/i18n/fr";
import { getOrganization } from "@/server/repositories/organizations";

export const metadata: Metadata = { title: fr.auth.setup2faTitle };

export default async function Setup2faPage() {
  const user = await requireUser({ allowPending2fa: true });
  if (user.twoFactorEnabled) redirect("/");
  const org = await getOrganization(user.organizationId);
  return <TwoFactorSetup issuer={org?.brand.name ?? fr.app.productName} mandatory={user.twoFactorRequired} />;
}
