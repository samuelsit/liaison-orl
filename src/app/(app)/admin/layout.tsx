import { AdminNav } from "@/components/admin/admin-nav";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { serviceModes } from "@/lib/env";
import { adminFr } from "@/lib/i18n/admin";

/**
 * Coquille de l'administration (cf. design §4.12) : le titre « Administration » (seul h1),
 * puis la sous-navigation groupée à gauche et la page à droite. Le seuil est une requête
 * de conteneur : la sous-navigation n'apparaît que si la zone de contenu est assez large,
 * barre latérale ouverte ou non. Chaque page appelle getAdminContext() elle-même.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <PageContainer className="@container/admin">
      <PageHeader title={adminFr.layoutTitle} className="mb-0 lg:mb-0" />
      <div className="grid gap-6 @4xl/admin:grid-cols-[13rem_minmax(0,1fr)] @4xl/admin:gap-10">
        <AdminNav demo={serviceModes().email === "mock"} />
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
