import "server-only";
import { randomUUID } from "node:crypto";
import type { PostalLetterState, PostalOptions, PostalProvider } from "./types";

const letters = new Map<string, { createdAt: number; invalid: string | null; sent: boolean; cancelled: boolean; priceCents: number }>();

/** Tarifs simulés (centimes d'euro) : ordre de grandeur d'une lettre verte / recommandée. */
export function mockPrice(opts: { deliveryProduct: string; printSpectrum: string; pages: number }): number {
  const base = opts.deliveryProduct === "registered" ? 620 : opts.deliveryProduct === "fast" ? 189 : 129;
  const perPage = opts.printSpectrum === "color" ? 15 : 8;
  return base + perPage * Math.max(0, opts.pages - 1);
}

/** Courrier simulé : validation instantanée, statuts qui évoluent dans le temps (mode démo). */
export class MockPostalProvider implements PostalProvider {
  readonly name = "mock-postal" as const;
  readonly mode = "mock" as const;

  async estimatePrice(opts: PostalOptions & { pages: number; country: string }) {
    return { cents: mockPrice({ ...opts }), currency: "EUR" };
  }

  async createLetter(input: { pdf: Buffer; fileName: string; options: PostalOptions; idempotencyKey: string; recipientCity: string; recipientPostalCode: string }) {
    const id = `mock_letter_${randomUUID()}`;
    const invalid = /inconnu/i.test(input.recipientCity) || input.recipientPostalCode === "00000" ? "Recipient address could not be validated (city / postcode)" : null;
    const pages = Math.max(1, (input.pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length);
    letters.set(id, { createdAt: Date.now(), invalid, sent: false, cancelled: false, priceCents: mockPrice({ ...input.options, pages }) });
    return this.getLetter(id);
  }

  async getLetter(externalId: string): Promise<PostalLetterState> {
    const l = letters.get(externalId);
    const base = { externalId, priceCents: l?.priceCents ?? 129, currency: "EUR", trackingNumber: null, issue: null };
    if (!l) return { ...base, rawStatus: "sent", status: "posted" };
    if (l.cancelled) return { ...base, rawStatus: "cancelled", status: "cancelled" };
    if (l.invalid) return { ...base, rawStatus: "action_required", status: "action_required", issue: l.invalid };
    if (!l.sent) return { ...base, rawStatus: "valid", status: "awaiting_confirmation" };
    return { ...base, rawStatus: "submitted", status: "sent" };
  }

  async sendLetter(externalId: string): Promise<PostalLetterState> {
    const l = letters.get(externalId);
    if (l) l.sent = true;
    return this.getLetter(externalId);
  }

  async cancelLetter(externalId: string) {
    const l = letters.get(externalId);
    if (l) l.cancelled = true;
  }

  verifyWebhook() {
    return false;
  }

  async ping() {}
}
