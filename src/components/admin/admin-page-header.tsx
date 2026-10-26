import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { adminSectionMeta, type AdminSectionKey } from "./admin-sections";

/**
 * En-tête d'une page d'administration : titre de section (h2, le h1 « Administration »
 * est dans le layout), description et action principale à droite.
 */
export function AdminPageHeader({
  section,
  description,
  actions,
  meta,
  children,
}: {
  section: AdminSectionKey;
  /** Remplace la description par défaut de la section. */
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const s = adminSectionMeta(section);
  return (
    <PageHeader level={2} title={s.title} description={description ?? s.description} actions={actions} meta={meta}>
      {children}
    </PageHeader>
  );
}
