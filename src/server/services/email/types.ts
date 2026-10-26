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
