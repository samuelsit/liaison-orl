import type { Metadata } from "next";
import { BrandEditor } from "@/components/admin/brand-editor";
import { getAdminContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Organisation et marque" };

export default async function BrandPage() {
  const { organization } = await getAdminContext();
  return (
    <>
      <p className="mb-4 text-muted-foreground">Changer de marque = modifier cette page : documents, e-mails et interface suivent immédiatement.</p>
      <BrandEditor initial={{ name: organization.name, brand: organization.brand, legal: { companyName: organization.legal.companyName, mentions: organization.legal.mentions } }} />
    </>
  );
}
