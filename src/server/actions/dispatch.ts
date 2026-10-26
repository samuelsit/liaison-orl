"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCan, canAccessCentre } from "@/lib/auth/permissions";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { channelSchema, type Channel, type DispatchStatus } from "@/lib/schemas/dispatch";
import { deliveryProductSchema } from "@/lib/schemas/organization";
import { formatPersonName } from "@/lib/text";
import { acknowledgeDispatch, bulkSend, cancelDispatch, prepareDispatch, retryDispatch, sendDocument, type BulkResult } from "@/server/services/dispatch";
import { refreshMockDispatches } from "@/server/services/dispatch-status";
import { runAction, type ActionResult } from "./result";

const postalSchema = z
  .object({
    deliveryProduct: deliveryProductSchema.optional(),
    printMode: z.enum(["simplex", "duplex"]).optional(),
    printSpectrum: z.enum(["color", "grayscale"]).optional(),
  })
  .optional();

export async function estimatePostalAction(documentId: string, postal: unknown): Promise<ActionResult<{ cents: number; currency: string } | null>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const plan = await prepareDispatch(ctx, z.string().parse(documentId), postalSchema.parse(postal), { audit: false });
    return plan.postal.estimate;
  });
}

export interface SentSummary {
  id: string;
  channel: "EMAIL" | "COURRIER";
  status: string;
  error: string | null;
}

export async function sendDocumentAction(documentId: string, input: unknown): Promise<ActionResult<SentSummary[]>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const parsed = z.object({ channels: z.array(channelSchema).min(1).max(2), copyToCentre: z.boolean().optional(), postal: postalSchema }).parse(input);
    const res = await sendDocument(ctx, z.string().parse(documentId), parsed);
    revalidatePath(`/documents/${documentId}`);
    revalidatePath("/envois");
    revalidatePath("/");
    return res.map((d) => ({ id: d._id, channel: d.channel, status: d.status, error: d.error?.message ?? null }));
  });
}

export async function retryDispatchAction(id: string): Promise<ActionResult<SentSummary[]>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await retryDispatch(ctx, z.string().parse(id));
    revalidatePath("/envois");
    return res.map((d) => ({ id: d._id, channel: d.channel, status: d.status, error: d.error?.message ?? null }));
  });
}

export async function cancelDispatchAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    await cancelDispatch(ctx, z.string().parse(id));
    revalidatePath("/envois");
    return undefined;
  }, "Courrier annulé.");
}

export async function acknowledgeDispatchAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    await acknowledgeDispatch(ctx, z.string().parse(id));
    revalidatePath("/envois");
    revalidatePath("/");
    return undefined;
  });
}

export async function bulkSendAction(documentIds: unknown): Promise<ActionResult<BulkResult[]>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const ids = z.array(z.string()).min(1).max(100).parse(documentIds);
    const res = await bulkSend(ctx, ids);
    revalidatePath("/documents");
    revalidatePath("/envois");
    revalidatePath("/");
    return res;
  });
}

/* ---------- Lectures seules pour l'interface (aucune règle métier nouvelle) ---------- */

export interface BulkPreviewItem {
  documentId: string;
  patientLabel: string;
  prescriberName: string | null;
  /** Canaux qui seront utilisés (canal préféré du prescripteur, selon disponibilité). */
  channels: Channel[];
  /** Raison pour laquelle le document sera ignoré, ou avertissement. */
  problem: string | null;
  postalCents: number | null;
  currency: string | null;
}

/**
 * Aperçu d'un envoi groupé : réutilise prepareDispatch (mêmes droits, mêmes règles
 * de canal que bulkSend), sans journaliser de préparation ni rien envoyer.
 */
export async function previewBulkSendAction(documentIds: unknown): Promise<ActionResult<BulkPreviewItem[]>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    assertCan(ctx.user, "document.send", ctx.organization.settings);
    const ids = z.array(z.string()).min(1).max(100).parse(documentIds);
    const items: BulkPreviewItem[] = [];
    for (const id of ids) {
      try {
        const plan = await prepareDispatch(ctx, id, undefined, { audit: false });
        const postal = plan.defaultChannels.includes("COURRIER") ? plan.postal.estimate : null;
        items.push({
          documentId: id,
          patientLabel: plan.patientLabel,
          prescriberName: plan.prescriber ? `${plan.prescriber.civility} ${formatPersonName(plan.prescriber.firstName, plan.prescriber.lastName)}` : null,
          channels: plan.defaultChannels,
          problem: plan.defaultChannels.length === 0 ? (plan.email.problem ?? plan.postal.errors[0] ?? null) : null,
          postalCents: postal?.cents ?? null,
          currency: postal?.currency ?? null,
        });
      } catch (err) {
        items.push({
          documentId: id,
          patientLabel: "",
          prescriberName: null,
          channels: [],
          problem: err instanceof Error ? err.message : null,
          postalCents: null,
          currency: null,
        });
      }
    }
    return items;
  });
}

export interface DispatchStatusItem {
  id: string;
  status: DispatchStatus;
  error: string | null;
}

/** Statuts actuels de quelques envois (panneau de succès du récapitulatif), filtrés par organisation et centre. */
export async function dispatchStatusesAction(ids: unknown): Promise<ActionResult<DispatchStatusItem[]>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const list = z.array(z.string()).min(1).max(10).parse(ids);
    // Comme au rendu des pages de suivi : fait évoluer les envois simulés (mode démo uniquement).
    await refreshMockDispatches(ctx.user.organizationId).catch(() => undefined);
    const docs = await collections()
      .dispatches()
      .find({ _id: { $in: list }, organizationId: ctx.user.organizationId }, { projection: { status: 1, error: 1, centreId: 1 } })
      .toArray();
    return docs
      .filter((d) => canAccessCentre(ctx.user, d.centreId))
      .map((d) => ({ id: d._id, status: d.status, error: d.error?.message ?? null }));
  });
}
