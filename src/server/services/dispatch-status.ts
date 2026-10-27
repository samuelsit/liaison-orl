import "server-only";
import { collections } from "@/lib/db/collections";
import type { DispatchDoc } from "@/lib/db/types";
import { ERROR_STATUSES, type DispatchEvent, type DispatchStatus } from "@/lib/schemas/dispatch";
import { nextStatusAllowed } from "@/lib/dispatch/status";

export interface StatusUpdate {
  status: DispatchStatus;
  type: string;
  at?: Date;
  detail?: string;
  source: DispatchEvent["source"];
  externalEventId?: string;
  error?: DispatchDoc["error"];
  costCents?: number | null;
}

/**
 * Applique un événement de statut à un envoi (idempotent : un événement externe déjà
 * reçu est ignoré ; un statut plus ancien ne remplace jamais un statut plus avancé).
 */
export async function applyDispatchUpdate(dispatchId: string, update: StatusUpdate): Promise<DispatchDoc | null> {
  const dispatch = await collections().dispatches().findOne({ _id: dispatchId });
  if (!dispatch) return null;
  if (update.externalEventId && dispatch.events.some((e) => e.externalEventId === update.externalEventId))
    return dispatch;

  const at = update.at ?? new Date();
  const event: DispatchEvent = {
    type: update.type,
    at,
    status: update.status,
    detail: update.detail,
    source: update.source,
    externalEventId: update.externalEventId,
  };
  const set: Partial<DispatchDoc> = { updatedAt: new Date() };
  if (nextStatusAllowed(dispatch.status, update.status)) {
    set.status = update.status;
    if (update.status === "sent" || update.status === "posted" || update.status === "printing")
      set.sentAt = dispatch.sentAt ?? at;
    if (update.status === "delivered") set.deliveredAt = dispatch.deliveredAt ?? at;
    if (update.status === "opened") {
      set.openedAt = dispatch.openedAt ?? at;
      set.deliveredAt = dispatch.deliveredAt ?? at;
    }
    if ((ERROR_STATUSES as readonly string[]).includes(update.status)) {
      set.error = update.error ??
        dispatch.error ?? { code: update.status, message: update.detail ?? "Échec de l'envoi", hint: "" };
      set.acknowledged = false;
    } else if (update.status !== "cancelled") {
      set.error = null;
    }
  }
  if (update.costCents !== undefined) set.costCents = update.costCents;

  await collections()
    .dispatches()
    .updateOne({ _id: dispatch._id }, { $set: set, $push: { events: event } });
  await syncDocumentStatus(dispatch.documentId);
  const updated = { ...dispatch, ...set, events: [...dispatch.events, event] };
  // Échec signalé après coup (webhook, suivi) : l'auteur est prévenu par e-mail.
  const isError = (s: DispatchStatus) => (ERROR_STATUSES as readonly string[]).includes(s);
  if (update.source !== "app" && set.status && isError(set.status) && !isError(dispatch.status)) {
    const { notifyDispatchError } = await import("./dispatch-notify");
    await notifyDispatchError(updated).catch((err: unknown) =>
      console.error("Notification d'échec d'envoi impossible", err),
    );
  }
  return updated;
}

/** Recalcule le statut du document à partir de ses envois. */
export async function syncDocumentStatus(documentId: string) {
  const doc = await collections().documents().findOne({ _id: documentId });
  if (!doc || doc.status === "BROUILLON") return;
  const dispatches = await collections()
    .dispatches()
    .find({ documentId, documentVersion: doc.version, status: { $ne: "cancelled" } })
    .toArray();
  if (dispatches.length === 0) {
    if (doc.status !== "VALIDE")
      await collections()
        .documents()
        .updateOne({ _id: doc._id }, { $set: { status: "VALIDE", lastError: null } });
    return;
  }
  const failing = dispatches.find((d) => (ERROR_STATUSES as readonly string[]).includes(d.status) && !d.acknowledged);
  const sent = dispatches.some((d) => ["sent", "delivered", "opened", "printing", "posted"].includes(d.status));
  const status = failing ? "ERREUR" : sent ? "ENVOYE" : "VALIDE";
  const sentAt = sent ? (doc.sentAt ?? new Date()) : doc.sentAt;
  await collections()
    .documents()
    .updateOne({ _id: doc._id }, { $set: { status, sentAt, lastError: failing?.error?.message ?? null } });
}

const SECOND = 1000;

/** Fait évoluer les envois simulés (mode démo) en fonction du temps écoulé. */
export async function refreshMockDispatches(organizationId?: string) {
  const pending = await collections()
    .dispatches()
    .find({
      ...(organizationId ? { organizationId } : {}),
      provider: { $in: ["mock-email", "mock-postal"] },
      status: { $in: ["sent", "delivered", "printing"] },
    })
    .limit(200)
    .toArray();
  const now = Date.now();
  for (const d of pending) {
    const since = now - (d.sentAt ?? d.createdAt).getTime();
    if (d.provider === "mock-email") {
      const bounce = (d.recipient.email ?? "").includes("rejet");
      if (d.status === "sent" && since > 15 * SECOND) {
        await applyDispatchUpdate(
          d._id,
          bounce
            ? {
                status: "bounced",
                type: "email.bounced",
                source: "mock",
                detail: "Adresse e-mail inexistante (simulation)",
                error: {
                  code: "bounced",
                  message: "L'e-mail a été rejeté par le serveur du destinataire.",
                  hint: "Vérifiez l'adresse e-mail du prescripteur dans l'annuaire, puis renvoyez.",
                },
              }
            : { status: "delivered", type: "email.delivered", source: "mock" },
        );
      }
    } else {
      if (d.status === "sent" && since > 30 * SECOND)
        await applyDispatchUpdate(d._id, { status: "printing", type: "letter.printing", source: "mock" });
      if (d.status === "printing" && since > 120 * SECOND)
        await applyDispatchUpdate(d._id, { status: "posted", type: "letter.sent", source: "mock" });
    }
  }
}
