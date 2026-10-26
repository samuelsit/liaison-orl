import "server-only";
import { collections } from "@/lib/db/collections";
import type { DispatchStatus } from "@/lib/schemas/dispatch";
import { applyDispatchUpdate } from "./dispatch-status";
import { applyPostalState } from "./dispatch";
import { postalProvider } from "./postal";
import { explainPostalIssue } from "./postal/status-map";

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: { email_id?: string; bounce?: { message?: string }; failed?: { reason?: string } };
}

const RESEND_STATUS: Record<string, DispatchStatus | null> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "opened",
  "email.bounced": "bounced",
  "email.complained": "bounced",
  "email.suppressed": "bounced",
  "email.failed": "failed",
  "email.delivery_delayed": null,
};

/** Traite un événement Resend (idempotent : l'identifiant Svix sert de clé de dédoublonnage). */
export async function handleResendEvent(event: ResendEvent, eventId: string): Promise<"ok" | "ignored"> {
  const emailId = event.data?.email_id;
  if (!emailId || !(event.type in RESEND_STATUS)) return "ignored";
  const dispatch = await collections().dispatches().findOne({ provider: "resend", externalId: emailId });
  if (!dispatch) return "ignored";
  const status = RESEND_STATUS[event.type];
  const at = event.created_at ? new Date(event.created_at) : new Date();
  if (!status) {
    await collections()
      .dispatches()
      .updateOne(
        { _id: dispatch._id, "events.externalEventId": { $ne: eventId } },
        { $push: { events: { type: event.type, at, source: "webhook", externalEventId: eventId, detail: "Remise retardée" } } },
      );
    return "ok";
  }
  const detail = event.data?.bounce?.message ?? event.data?.failed?.reason;
  await applyDispatchUpdate(dispatch._id, {
    status,
    type: event.type,
    at,
    source: "webhook",
    externalEventId: eventId,
    detail,
    error:
      status === "bounced" || status === "failed"
        ? {
            code: event.type,
            message: status === "bounced" ? "L'e-mail a été rejeté par le serveur du destinataire." : "L'e-mail n'a pas pu être envoyé.",
            hint: "Vérifiez l'adresse e-mail du prescripteur dans l'annuaire, puis renvoyez.",
          }
        : undefined,
  });
  return "ok";
}

interface PingenWebhook {
  data?: {
    id?: string;
    type?: string;
    attributes?: { reason?: string; created_at?: string };
    relationships?: { deliverable?: { data?: { id?: string } }; letter?: { data?: { id?: string } } };
  };
}

/** Traite un webhook Pingen (issues / sent / undeliverable / delivered). */
export async function handlePingenEvent(payload: PingenWebhook): Promise<"ok" | "ignored"> {
  const d = payload.data;
  const letterId = d?.relationships?.deliverable?.data?.id ?? d?.relationships?.letter?.data?.id;
  if (!d?.id || !letterId) return "ignored";
  const dispatch = await collections().dispatches().findOne({ provider: "pingen", externalId: letterId });
  if (!dispatch) return "ignored";
  if (dispatch.events.some((e) => e.externalEventId === d.id)) return "ok";
  const at = d.attributes?.created_at ? new Date(d.attributes.created_at) : new Date();
  const reason = d.attributes?.reason ?? null;
  switch (d.type) {
    case "webhook_sent":
    case "webhook_delivered":
      await applyDispatchUpdate(dispatch._id, { status: "posted", type: d.type, at, source: "webhook", externalEventId: d.id });
      break;
    case "webhook_undeliverable":
      await applyDispatchUpdate(dispatch._id, { status: "undeliverable", type: d.type, at, source: "webhook", externalEventId: d.id, detail: reason ?? undefined, error: { code: "undeliverable", ...explainPostalIssue(reason ?? "undeliverable") } });
      break;
    case "webhook_issues": {
      // Le détail exact est relu auprès de Pingen (statut action requise / invalide…).
      try {
        const state = await postalProvider().getLetter(letterId);
        state.issue = state.issue ?? reason;
        await applyPostalState(dispatch._id, state, "webhook");
        await collections().dispatches().updateOne({ _id: dispatch._id }, { $push: { events: { type: d.type, at, source: "webhook", externalEventId: d.id, detail: reason ?? undefined } } });
      } catch {
        await applyDispatchUpdate(dispatch._id, { status: "action_required", type: d.type, at, source: "webhook", externalEventId: d.id, detail: reason ?? undefined, error: { code: "issue", ...explainPostalIssue(reason) } });
      }
      break;
    }
    default:
      return "ignored";
  }
  return "ok";
}

/** Relance périodique : courriers Pingen en cours (envoi après validation, suivi des statuts). */
export async function pollPostalDispatches(): Promise<number> {
  const pending = await collections()
    .dispatches()
    .find({ provider: "pingen", status: { $in: ["queued", "sent", "printing", "action_required"] }, externalId: { $ne: null } })
    .limit(100)
    .toArray();
  for (const d of pending) {
    try {
      let state = await postalProvider().getLetter(d.externalId!);
      if (state.status === "awaiting_confirmation" && d.options.confirmedByUser) {
        state = await postalProvider().sendLetter(d.externalId!, {
          deliveryProduct: d.options.deliveryProduct as "cheap",
          printMode: d.options.printMode as "simplex",
          printSpectrum: d.options.printSpectrum as "color",
          addressPosition: "right",
        }, d.idempotencyKey);
      }
      if (state.status !== d.status) await applyPostalState(d._id, state, "poll");
    } catch (err) {
      console.error("Suivi Pingen", d._id, err);
    }
  }
  return pending.length;
}
