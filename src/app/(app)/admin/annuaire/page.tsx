import type { Metadata } from "next";
import { DuplicatesAdmin } from "@/components/admin/duplicates-admin";
import { getAdminContext } from "@/lib/auth/session";
import { listDuplicateGroups } from "@/server/services/prescribers";

export const metadata: Metadata = { title: "Annuaire global" };

export default async function DirectoryAdminPage() {
  const ctx = await getAdminContext();
  const groups = await listDuplicateGroups(ctx);
  return <DuplicatesAdmin groups={groups} />;
}
