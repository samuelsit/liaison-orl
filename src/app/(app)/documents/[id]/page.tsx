import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/documents/editor/document-editor";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { serviceModes } from "@/lib/env";
import { fr } from "@/lib/i18n/fr";
import { formatPersonName } from "@/lib/text";
import { audit } from "@/server/audit";
import { actor, getDocumentForUser } from "@/server/services/documents";
import { toPatientView } from "@/server/services/patients";
import { toPrescriberView } from "@/server/services/prescribers";
import { toAttachmentView } from "@/server/services/attachments";
import { UserFacingError } from "@/server/actions/result";
import { ForbiddenError } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  let doc;
  try {
    doc = await getDocumentForUser(ctx, id);
  } catch (err) {
    if (err instanceof UserFacingError || err instanceof ForbiddenError) notFound();
    throw err;
  }
  await audit(actor(ctx), "document.view", "document", doc._id);
  const [patient, prescriber, author, attachments] = await Promise.all([
    doc.patientId ? collections().patients().findOne({ _id: doc.patientId, organizationId: doc.organizationId }) : null,
    doc.prescriberId ? collections().prescribers().findOne({ _id: doc.prescriberId, organizationId: doc.organizationId }) : null,
    collections().users().findOne({ _id: doc.authorId, organizationId: doc.organizationId }, { projection: { firstName: 1, lastName: 1 } }),
    collections().attachments().find({ documentId: doc._id, organizationId: doc.organizationId }).sort({ createdAt: -1 }).toArray(),
  ]);
  const settings = ctx.organization.settings;
  return (
    <DocumentEditor
      key={`${doc._id}-${doc.status}-${doc.version}`}
      doc={{
        id: doc._id,
        type: doc.type,
        status: doc.status,
        version: doc.version,
        updatedAt: doc.updatedAt.toISOString(),
        data: doc.data,
        aiFields: doc.aiFields,
        authorName: author ? formatPersonName(author.firstName, author.lastName) : "",
      }}
      initialPatient={patient ? toPatientView(patient) : null}
      initialPrescriber={prescriber ? toPrescriberView(prescriber, ctx.user.id) : null}
      shared={{
        centres: ctx.centres.map((c) => ({ id: c._id, name: c.name })),
        activeCentreId: ctx.activeCentre._id,
        salutations: settings.documents.salutations,
        defaultSalutation: settings.documents.defaultSalutation || fr.common.none,
        canEditDirectory: can(ctx.user, "prescriber.edit", settings),
        aiEnabled: settings.ai.enabled,
        dictationEnabled: settings.ai.dictation,
        aiMode: serviceModes().ai,
      }}
      permissions={{
        canValidate: can(ctx.user, "document.validate", settings),
        canSend: can(ctx.user, "document.send", settings),
        canDelete: ctx.user.role !== "assistant" || doc.authorId === ctx.user.id,
      }}
      attachments={attachments.map(toAttachmentView)}
    />
  );
}
