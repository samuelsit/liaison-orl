import type { DispatchStatus } from "@/lib/schemas/dispatch";
import type { DeliveryProduct } from "@/lib/schemas/organization";

export interface PostalOptions {
  deliveryProduct: DeliveryProduct;
  printMode: "simplex" | "duplex";
  printSpectrum: "color" | "grayscale";
  addressPosition: "left" | "right";
}

export interface PostalLetterState {
  externalId: string;
  /** Statut brut du prestataire. */
  rawStatus: string;
  status: DispatchStatus;
  priceCents: number | null;
  currency: string | null;
  trackingNumber: string | null;
  /** Motif de refus / problème signalé, en français si possible. */
  issue: string | null;
}

export interface PostalProvider {
  readonly name: "pingen" | "mock-postal";
  readonly mode: "live" | "mock";
  estimatePrice(opts: PostalOptions & { pages: number; country: string }): Promise<{ cents: number; currency: string } | null>;
  createLetter(input: { pdf: Buffer; fileName: string; options: PostalOptions; idempotencyKey: string; recipientCity: string; recipientPostalCode: string }): Promise<PostalLetterState>;
  getLetter(externalId: string): Promise<PostalLetterState>;
  sendLetter(externalId: string, options: PostalOptions, idempotencyKey: string): Promise<PostalLetterState>;
  cancelLetter(externalId: string): Promise<void>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  ping(): Promise<void>;
}

export class PostalError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hint: string,
  ) {
    super(message);
    this.name = "PostalError";
  }
}
