import "server-only";
import { randomUUID } from "node:crypto";
import { collections } from "@/lib/db/collections";
import { formatFrom } from "./from";
import type { EmailProvider, OutgoingEmail } from "./types";

/** E-mails simulés : enregistrés dans la « boîte d'envoi de démonstration ». */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock-email" as const;
  readonly mode = "mock" as const;

  async send(email: OutgoingEmail) {
    if (email.idempotencyKey) {
      const existing = await collections().outbox().findOne({ _id: `idem_${email.idempotencyKey}` });
      if (existing) return { id: existing.externalId };
    }
    const id = `mock_email_${randomUUID()}`;
    await collections().outbox().insertOne({
      _id: email.idempotencyKey ? `idem_${email.idempotencyKey}` : randomUUID(),
      organizationId: email.organizationId,
      kind: email.kind,
      from: formatFrom(email.fromName),
      to: email.to,
      cc: email.cc ?? [],
      replyTo: email.replyTo ?? null,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: (email.attachments ?? []).map((a) => ({ filename: a.filename, size: a.content.length })),
      externalId: id,
      createdAt: new Date(),
    });
    if (process.env.NODE_ENV === "development") {
      console.info(`[e-mail simulé] ${email.subject} → ${email.to.join(", ")}`);
    }
    return { id };
  }

  async ping() {}
}

