import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { DocumentList } from "@/components/documents/document-list";
import { DispatchList } from "@/components/dispatches/dispatch-list";
import { PatientActions } from "@/components/patients/patient-actions";
import { formatPrescriberName } from "@/components/prescribers/format";
import { can, canAccessCentre } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { ageAt, formatIsoDate, todayIso } from "@/lib/dates";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { formatPersonName } from "@/lib/text";
import { audit } from "@/server/audit";
import { actor, listDocuments } from "@/server/services/documents";
import { hydrateDispatches, hydrateDocuments } from "@/server/services/hydrate";
import { toPatientView } from "@/server/services/patients";
import { toPrescriberView } from "@/server/services/prescribers";

export const metadata: Metadata = { title: "Fiche patient" };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const doc = await collections().patients().findOne({ _id: id, organizationId: ctx.user.organizationId });
  if (!doc || !canAccessCentre(ctx.user, doc.centreId)) notFound();
  await audit(actor(ctx), "patient.view", "patient", id);
  const patient = toPatientView(doc);
  const prescriberDoc = doc.usualPrescriberId ? await collections().prescribers().findOne({ _id: doc.usualPrescriberId, organizationId: ctx.user.organizationId }) : null;
  const prescriber = prescriberDoc ? toPrescriberView(prescriberDoc, ctx.user.id) : null;
  const [docs, dispatches] = await Promise.all([
    listDocuments(ctx.user.organizationId, { centreIds: ctx.centres.map((c) => c._id), patientId: id }, 50),
    collections().dispatches().find({ organizationId: ctx.user.organizationId, centreId: { $in: ctx.centres.map((c) => c._id) }, patientId: id }).sort({ createdAt: -1 }).limit(50).toArray(),
  ]);
  const [docItems, dispatchItems] = await Promise.all([hydrateDocuments(docs), hydrateDispatches(dispatches)]);
  const age = patient.birthDate ? ageAt(patient.birthDate, todayIso()) : null;
  const centre = ctx.centres.find((c) => c._id === patient.centreId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        back={
          <Link href="/patients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> {fr.nav.patients}
          </Link>
        }
        title={`${patient.civility} ${formatPersonName(patient.firstName, patient.lastName)}`}
        description={[patient.birthDate ? `Né(e) le ${formatIsoDate(patient.birthDate)}${age !== null ? ` · ${age} ans` : ""}` : "Date de naissance non renseignée", centre?.name].filter(Boolean).join(" · ")}
        actions={
          <PatientActions
            patient={patient}
            prescriber={prescriber}
            centres={ctx.centres.map((c) => ({ id: c._id, name: c.name }))}
            salutations={ctx.organization.settings.documents.salutations}
            canDelete={can(ctx.user, "patient.delete", ctx.organization.settings)}
          />
        }
      />
      <div className="rounded-xl border bg-card p-5 text-sm">
        <span className="text-muted-foreground">{dirFr.patients.fields.usualPrescriber} : </span>
        {prescriber ? (
          <Link href={`/prescripteurs/${prescriber.id}`} className="font-medium hover:underline">
            {formatPrescriberName(prescriber)}
          </Link>
        ) : (
          "non renseigné"
        )}
      </div>
      <SectionCard flush title={dirFr.patients.history} count={docItems.length}>
        <DocumentList items={docItems} empty="Aucun document pour ce patient." />
      </SectionCard>
      <SectionCard flush title="Envois" count={dispatchItems.length}>
        <DispatchList items={dispatchItems} empty="Aucun envoi pour ce patient." />
      </SectionCard>
    </div>
  );
}
