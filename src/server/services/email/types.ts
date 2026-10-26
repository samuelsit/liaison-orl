import type { OutboxDoc } from "@/lib/db/types";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface OutgoingEmail {
  kind: OutboxDoc["kind"];
  organizationId: string | null;
  fromName: string;
  to: string[];
  cc?: string[];
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export interface EmailProvider {
  readonly name: "resend" | "mock-email";
  readonly mode: "live" | "mock";
  send(email: OutgoingEmail): Promise<{ id: string }>;
  ping(): Promise<void>;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/**
 * Conseil affiché sous un échec d'envoi : seul un refus portant sur le destinataire
 * renvoie vers la fiche du prescripteur ; un expéditeur mal configuré relève de l'administrateur.
 */
export function emailErrorHint(err: EmailSendError): string {
  if (err.retryable) return "Réessayez dans quelques minutes.";
  const m = err.message;
  if (err.code === "sender_config") return `Configuration de l'expéditeur à corriger par l'administrateur. ${m}`;
  if (/domain is not verified|not verified/i.test(m)) {
    return `Le domaine d'expédition n'est pas vérifié chez Resend : l'administrateur doit finaliser la vérification DNS (Resend → Domains). (${m})`;
  }
  if (/`from`|\bfrom\b/i.test(m)) return `Adresse d'expédition refusée par Resend : l'administrateur doit vérifier EMAIL_FROM_DOMAIN / EMAIL_FROM_ADDRESS. (${m})`;
  if (/api key|unauthori[sz]ed|forbidden|restricted/i.test(m)) return `Clé Resend refusée : l'administrateur doit vérifier RESEND_API_KEY. (${m})`;
  return `Vérifiez l'adresse e-mail du prescripteur dans l'annuaire, puis renvoyez. (${m})`;
}
