import type { Metadata } from "next";
import { RetentionAdmin } from "@/components/admin/retention-admin";
import { getAdminContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Conservation des données" };

export default async function RetentionPage() {
  const { organization } = await getAdminContext();
  return <RetentionAdmin settings={organization.settings} />;
}
