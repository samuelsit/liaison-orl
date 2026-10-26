import type { Metadata } from "next";
import { CentresAdmin } from "@/components/admin/centres-admin";
import { getAdminContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { listCentres } from "@/server/repositories/organizations";

export const metadata: Metadata = { title: "Centres" };

export default async function CentresPage() {
  const ctx = await getAdminContext();
  const centres = await listCentres(ctx.user.organizationId, { includeInactive: true });
  const [users, docs] = await Promise.all([
    collections().users().find({ organizationId: ctx.user.organizationId }, { projection: { centreIds: 1, role: 1 } }).toArray(),
    collections()
      .documents()
      .aggregate<{ _id: string; n: number }>([{ $match: { organizationId: ctx.user.organizationId } }, { $group: { _id: "$centreId", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const docCount = new Map(docs.map((d) => [d._id, d.n]));
  return (
    <CentresAdmin
      brandName={ctx.organization.brand.name}
      rows={centres.map((c) => ({
        id: c._id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        email: c.email,
        defaultSignature: c.defaultSignature,
        senderAddress: c.senderAddress,
        active: c.active,
        users: users.filter((u) => u.role !== "admin" && u.centreIds.includes(c._id)).length,
        documents: docCount.get(c._id) ?? 0,
      }))}
    />
  );
}
