import type { Metadata } from "next";
import { PatientDirectory } from "@/components/patients/patient-directory";
import { formatPrescriberName } from "@/components/prescribers/format";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { listPatients } from "@/server/services/patients";

export const metadata: Metadata = { title: "Patients" };

const PAGE_SIZE = 50;

export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const scope = sp.portee === "all" ? "all" : "active";
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listPatients(ctx, { q, scope, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const organizationId = ctx.user.organizationId;
  const patientIds = items.map((p) => p.id);
  const prescriberIds = [...new Set(items.map((p) => p.usualPrescriberId).filter((v): v is string => Boolean(v)))];
  const [prescribers, drafts] = await Promise.all([
    prescriberIds.length
      ? collections()
          .prescribers()
          .find({ _id: { $in: prescriberIds }, organizationId }, { projection: { civility: 1, firstName: 1, lastName: 1 } })
          .toArray()
      : [],
    // Lecture seule : brouillons en cours de ces patients dans les centres de l'utilisateur (puce « Brouillon en cours »).
    patientIds.length
      ? collections()
          .documents()
          .find(
            { organizationId, patientId: { $in: patientIds }, centreId: { $in: ctx.centres.map((c) => c._id) }, status: "BROUILLON" },
            { projection: { _id: 1, patientId: 1 } },
          )
          .sort({ updatedAt: -1 })
          .toArray()
      : [],
  ]);
  const draftByPatient: Record<string, string> = {};
  for (const d of drafts) if (d.patientId && !draftByPatient[d.patientId]) draftByPatient[d.patientId] = d._id;

  return (
    <PatientDirectory
      items={items}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      scope={scope}
      centres={ctx.centres.map((c) => ({ id: c._id, name: c.name }))}
      activeCentreId={ctx.activeCentre._id}
      activeCentreName={ctx.activeCentre.name}
      prescriberNames={Object.fromEntries(prescribers.map((p) => [p._id, formatPrescriberName(p)]))}
      drafts={draftByPatient}
      salutations={ctx.organization.settings.documents.salutations}
      openNew={sp.nouveau === "1"}
    />
  );
}
