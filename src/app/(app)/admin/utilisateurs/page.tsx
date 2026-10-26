import type { Metadata } from "next";
import { UsersAdmin } from "@/components/admin/users-admin";
import { getAdminContext } from "@/lib/auth/session";
import { listUsers } from "@/server/services/admin";
import { listCentres } from "@/server/repositories/organizations";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const ctx = await getAdminContext();
  const [users, centres] = await Promise.all([listUsers(ctx), listCentres(ctx.user.organizationId)]);
  return <UsersAdmin users={users} centres={centres.map((c) => ({ id: c._id, name: c.name }))} currentUserId={ctx.user.id} />;
}
