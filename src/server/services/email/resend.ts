import "server-only";
import { Resend } from "resend";
import { formatFrom, senderAddress } from "./from";
import { EmailSendError, type EmailProvider, type OutgoingEmail } from "./types";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  readonly mode = "live" as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(email: OutgoingEmail) {
    const { issue } = senderAddress();
    if (issue) throw new EmailSendError(issue, "sender_config", false);
    const { data, error } = await this.client.emails.send(
      {
        from: formatFrom(email.fromName),
        to: email.to,
        cc: email.cc && email.cc.length > 0 ? email.cc : undefined,
        replyTo: email.replyTo ?? undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
        tags: email.tags ? Object.entries(email.tags).map(([name, value]) => ({ name, value })) : undefined,
      },
      email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
    );
    if (error || !data) {
      const code = error?.name ?? "unknown_error";
      const retryable = ["rate_limit_exceeded", "application_error", "internal_server_error"].includes(code);
      throw new EmailSendError(error?.message ?? "Échec de l'envoi de l'e-mail", code, retryable);
    }
    return { id: data.id };
  }

  async ping() {
    const { issue } = senderAddress();
    if (issue) throw new Error(issue);
    const { error } = await this.client.domains.list();
    if (error) throw new Error(error.message);
  }
}
