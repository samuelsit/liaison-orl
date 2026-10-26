import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { getAdminContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Envois et droits" };

export default async function Page() {
  const { organization } = await getAdminContext();
  return <SettingsForm initial={organization.settings} section="envois" />;
}
