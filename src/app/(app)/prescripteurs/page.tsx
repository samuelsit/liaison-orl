import type { Metadata } from "next";
import { PrescriberDirectory } from "@/components/prescribers/prescriber-directory";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { SPECIALTIES } from "@/lib/schemas/prescriber";
import { listPrescribers, type PrescriberFilter } from "@/server/services/prescribers";

export const metadata: Metadata = { title: "Annuaire ORL" };

const FILTERS: PrescriberFilter[] = ["all", "favorites", "centre", "archived"];
const PAGE_SIZE = 50;

export default async function PrescribersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const filter = FILTERS.includes(sp.filtre as PrescriberFilter) ? (sp.filtre as PrescriberFilter) : "all";
  const specialty = (SPECIALTIES as readonly string[]).includes(sp.specialite ?? "") ? sp.specialite! : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listPrescribers(ctx, {
    q,
    filter,
    specialty: specialty ?? undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const settings = ctx.organization.settings;
  return (
    <PrescriberDirectory
      items={items}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      filter={filter}
      specialty={specialty}
      activeCentreName={ctx.activeCentre.name}
      centres={ctx.centres.map((c) => ({ id: c._id, name: c.name }))}
      salutations={settings.documents.salutations}
      canImport={can(ctx.user, "prescriber.import", settings)}
      canArchive={can(ctx.user, "prescriber.archive", settings)}
      canEdit={can(ctx.user, "prescriber.edit", settings)}
      openNew={sp.nouveau === "1"}
    />
  );
}
