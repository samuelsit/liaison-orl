import type { Metadata } from "next";
import type { Filter } from "mongodb";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentsTable } from "@/components/documents/documents-table";
import { DocumentsNewMenu } from "@/components/documents/documents-new-menu";
import type { DocumentStatusCounts } from "@/components/documents/document-search";
import { pageSize } from "@/components/dispatches/list-utils";
import { getUserContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { collections } from "@/lib/db/collections";
import type { DocumentDoc } from "@/lib/db/types";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, type DocumentStatus, type DocumentType } from "@/lib/schemas/document";
import { prefixWordsRegex } from "@/lib/text";
import { fr } from "@/lib/i18n/fr";
import { hydrateDocuments } from "@/server/services/hydrate";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  const sp = await searchParams;
  const status = DOCUMENT_STATUSES.includes(sp.statut as DocumentStatus) ? (sp.statut as DocumentStatus) : null;
  const type = DOCUMENT_TYPES.includes(sp.type as DocumentType) ? (sp.type as DocumentType) : null;
  const mine = sp.auteur === "moi";
  const allCentres = sp.centres === "tous" && ctx.centres.length > 1;
  const q = (sp.q ?? "").slice(0, 80);
  const limit = pageSize(sp.n);

  // Filtre de base (hors statut) : sert aux compteurs du contrôle segmenté.
  const base: Filter<DocumentDoc> = {
    organizationId: ctx.user.organizationId,
    centreId: { $in: allCentres ? ctx.centres.map((c) => c._id) : [ctx.activeCentre._id] },
  };
  if (type) base.type = type;
  if (mine) base.authorId = ctx.user.id;
  const regex = q ? prefixWordsRegex(q) : null;
  if (regex) {
    const patients = await collections()
      .patients()
      .find({ organizationId: ctx.user.organizationId, searchText: regex }, { projection: { _id: 1 } })
      .limit(200)
      .toArray();
    base.patientId = { $in: patients.map((p) => p._id) };
  }
  const filter: Filter<DocumentDoc> = status ? { ...base, status } : base;

  const [docs, grouped] = await Promise.all([
    collections().documents().find(filter).sort({ updatedAt: -1 }).limit(limit).toArray(),
    collections()
      .documents()
      .aggregate<{ _id: DocumentStatus; n: number }>([{ $match: base }, { $group: { _id: "$status", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const items = await hydrateDocuments(docs);

  const counts = Object.fromEntries([["all", 0], ...DOCUMENT_STATUSES.map((s) => [s, 0])]) as DocumentStatusCounts;
  for (const g of grouped) {
    if (!DOCUMENT_STATUSES.includes(g._id)) continue;
    counts[g._id] = g.n;
    counts.all += g.n;
  }

  return (
    <PageContainer>
      {/* Mobile : la barre d'onglets porte déjà « Nouveau ». */}
      <PageHeader title={fr.nav.documents} actions={<DocumentsNewMenu className="max-md:hidden" />} />
      <DocumentsTable
        items={items}
        viewer={{ userId: ctx.user.id, role: ctx.user.role, canSend: can(ctx.user, "document.send", ctx.organization.settings) }}
        filters={{ status, type, mine, allCentres, q }}
        counts={counts}
        total={status ? counts[status] : counts.all}
        multiCentre={ctx.centres.length > 1}
      />
    </PageContainer>
  );
}
