import { z } from "zod";

export const CHANNELS = ["EMAIL", "COURRIER"] as const;
export const channelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof channelSchema>;

/** Statuts unifiés (e-mail et courrier). */
export const DISPATCH_STATUSES = [
  "queued", // en file
  "awaiting_confirmation", // courrier créé chez le prestataire, en attente de confirmation
  "sent", // envoyé (e-mail accepté / courrier transmis)
  "delivered", // e-mail délivré
  "opened", // e-mail ouvert / lien consulté
  "printing", // courrier en impression
  "posted", // courrier remis à La Poste / distribué
  "action_required", // le prestataire signale un problème corrigeable
  "bounced", // e-mail rejeté
  "undeliverable", // courrier non distribuable
  "failed", // erreur
  "cancelled",
] as const;
export const dispatchStatusSchema = z.enum(DISPATCH_STATUSES);
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>;

export const ERROR_STATUSES: readonly DispatchStatus[] = ["action_required", "bounced", "undeliverable", "failed"];
export const FINAL_STATUSES: readonly DispatchStatus[] = ["opened", "posted", "bounced", "undeliverable", "failed", "cancelled"];

export interface DispatchEvent {
  type: string;
  at: Date;
  status?: DispatchStatus;
  detail?: string;
  source: "app" | "webhook" | "poll" | "mock";
  externalEventId?: string;
}

export interface DispatchDoc {
  _id: string;
  organizationId: string;
  centreId: string;
  documentId: string;
  documentVersion: number;
  patientId: string | null;
  prescriberId: string | null;
  channel: Channel;
  recipient: {
    name: string;
    email: string | null;
    address: { line1: string; line2: string; postalCode: string; city: string; country: string } | null;
  };
  status: DispatchStatus;
  provider: "resend" | "pingen" | "mock-email" | "mock-postal";
  externalId: string | null;
  /** Coût en centimes d'euro (courrier). */
  costCents: number | null;
  currency: string | null;
  options: Record<string, string | boolean | number>;
  idempotencyKey: string;
  error: { code: string; message: string; hint: string } | null;
  events: DispatchEvent[];
  secureLinkId: string | null;
  pdfKey: string | null;
  proofKey: string | null;
  createdBy: string;
  batchId: string | null;
  /** Erreur traitée / masquée par l'utilisateur. */
  acknowledged?: boolean;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
}
