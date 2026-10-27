import "server-only";
import { appUrl } from "@/lib/env";
import { centreDisplayName } from "@/lib/brand";
import { collections } from "@/lib/db/collections";
import type { DispatchDoc } from "@/lib/db/types";
import { emailFr } from "@/lib/i18n/email";
import { fr } from "@/lib/i18n/fr";
import { initials } from "@/lib/text";
import { getOrganization } from "@/server/repositories/organizations";
import { emailBrand, renderEmail } from "@/server/emails/render";
import { dispatchErrorEmail } from "@/server/emails/system";
import { emailProvider } from "./email";

/**
 * Prévient l'auteur d'un envoi qui échoue après coup (refus d'adresse Pingen, rebond
 * d'e-mail reçu par webhook…) : l'utilisateur n'a plus l'écran d'envoi sous les yeux.
 * Le patient n'est désigné que par ses initiales.
 */
export async function notifyDispatchError(dispatch: DispatchDoc): Promise<void> {
  const [org, doc, author, centre] = await Promise.all([
    getOrganization(dispatch.organizationId),
    collections().documents().findOne({ _id: dispatch.documentId, organizationId: dispatch.organizationId }),
    collections().users().findOne({ _id: dispatch.createdBy, organizationId: dispatch.organizationId }),
    collections().centres().findOne({ _id: dispatch.centreId, organizationId: dispatch.organizationId }),
  ]);
  if (!org || !doc || !author?.email || author.active === false) return;
  const patient = doc.snapshot?.patient;
  const patientLabel = patient
    ? `${patient.civility} ${initials(patient.firstName, patient.lastName)}`.trim()
    : "votre patient(e)";
  const documentLabel = fr.documentTypes[doc.type];
  const centreName = centre ? centreDisplayName(org.brand.name, centre.name) : org.brand.name;
  const content = dispatchErrorEmail({
    brand: emailBrand(org, centre ? { displayName: centreName, centre } : null),
    url: `${appUrl()}/envois/${dispatch._id}`,
    documentLabel,
    patientLabel,
    channel: dispatch.channel,
    recipient: dispatch.recipient.name,
    reason: dispatch.error?.message ?? "Échec de l'envoi",
    hint: dispatch.error?.hint ?? "",
  });
  const { html, text } = await renderEmail(content);
  await emailProvider().send({
    kind: "dispatch-error",
    organizationId: org._id,
    fromName: centreName,
    to: [author.email],
    subject: emailFr.dispatchError.subject(documentLabel, patientLabel),
    html,
    text,
    idempotencyKey: `${dispatch.idempotencyKey}:error:${dispatch.events.length}`,
  });
}
