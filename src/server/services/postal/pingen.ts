import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PostalLetterState, PostalOptions, PostalProvider } from "./types";
import { PostalError } from "./types";
import { mapPingenStatus } from "./status-map";

interface PingenConfig {
  clientId: string;
  clientSecret: string;
  organisationId: string;
  environment: "staging" | "production";
  webhookSecret?: string;
}

interface LetterJson {
  data: {
    id: string;
    attributes: {
      status: string;
      price_value?: number | null;
      price_currency?: string | null;
      tracking_number?: string | null;
    };
  };
}

/** Client Pingen API v2 (OAuth2 client_credentials, JSON:API). */
export class PingenProvider implements PostalProvider {
  readonly name = "pingen" as const;
  readonly mode = "live" as const;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly cfg: PingenConfig) {}

  private get api() {
    return this.cfg.environment === "production" ? "https://api.pingen.com" : "https://api-staging.pingen.com";
  }

  private get identity() {
    return this.cfg.environment === "production" ? "https://identity.pingen.com" : "https://identity-staging.pingen.com";
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await fetch(`${this.identity}/auth/access-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, scope: "letter webhook organisation_read" }),
    });
    if (!res.ok) throw new PostalError("Authentification Pingen refusée.", "auth", "Vérifiez PINGEN_CLIENT_ID / PINGEN_CLIENT_SECRET et l'environnement (staging/production).");
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return this.token.value;
  }

  private async request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string, attempt = 0): Promise<T> {
    const res = await fetch(`${this.api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        Accept: "application/vnd.api+json",
        ...(body ? { "Content-Type": "application/vnd.api+json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 64) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 429 || res.status === 503 || res.status === 409) && attempt < 3) {
      const wait = Number(res.headers.get("retry-after")) || [1, 5, 10][attempt]!;
      await new Promise((r) => setTimeout(r, wait * 1000));
      return this.request<T>(method, path, body, idempotencyKey, attempt + 1);
    }
    if (res.status === 401 && attempt === 0) {
      this.token = null;
      return this.request<T>(method, path, body, idempotencyKey, attempt + 1);
    }
    if (!res.ok) {
      let detail = "";
      try {
        const json = (await res.json()) as { errors?: { title?: string; detail?: string }[] };
        detail = json.errors?.map((e) => e.detail || e.title).filter(Boolean).join(" ; ") ?? "";
      } catch {
        // corps non JSON
      }
      throw new PostalError(`Pingen a répondu ${res.status}${detail ? ` : ${detail}` : ""}`, `http_${res.status}`, res.status === 422 ? "Vérifiez l'adresse et les options d'envoi." : "Réessayez dans quelques minutes.");
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private toState(json: LetterJson): PostalLetterState {
    const a = json.data.attributes;
    return {
      externalId: json.data.id,
      rawStatus: a.status,
      status: mapPingenStatus(a.status),
      priceCents: typeof a.price_value === "number" ? Math.round(a.price_value * 100) : null,
      currency: a.price_currency ?? null,
      trackingNumber: a.tracking_number ?? null,
      issue: null,
    };
  }

  private base() {
    return `/organisations/${this.cfg.organisationId}/deliveries/letters`;
  }

  async estimatePrice(opts: PostalOptions & { pages: number; country: string }) {
    const json = await this.request<{ data: { attributes: { currency: string; price: number } } }>("POST", `${this.base()}/price-calculator`, {
      data: {
        type: "letter_price_calculator",
        attributes: {
          country: opts.country,
          paper_types: Array.from({ length: Math.max(1, opts.pages) }, () => "normal"),
          print_mode: opts.printMode,
          print_spectrum: opts.printSpectrum,
          delivery_product: opts.deliveryProduct,
        },
      },
    });
    return { cents: Math.round(json.data.attributes.price * 100), currency: json.data.attributes.currency };
  }

  async createLetter(input: { pdf: Buffer; fileName: string; options: PostalOptions; idempotencyKey: string }): Promise<PostalLetterState> {
    const upload = await this.request<{ data: { attributes: { url: string; url_signature: string } } }>("GET", "/file-upload");
    const put = await fetch(upload.data.attributes.url, { method: "PUT", body: new Uint8Array(input.pdf) });
    if (!put.ok) throw new PostalError("Le dépôt du PDF chez Pingen a échoué.", "upload", "Réessayez dans quelques minutes.");
    const json = await this.request<LetterJson>(
      "POST",
      this.base(),
      {
        data: {
          type: "letters",
          attributes: {
            file_original_name: input.fileName,
            file_url: upload.data.attributes.url,
            file_url_signature: upload.data.attributes.url_signature,
            address_position: input.options.addressPosition,
            auto_send: false,
            delivery_product: input.options.deliveryProduct,
            print_mode: input.options.printMode,
            print_spectrum: input.options.printSpectrum,
          },
        },
      },
      `create-${input.idempotencyKey}`,
    );
    return this.toState(json);
  }

  async getLetter(externalId: string): Promise<PostalLetterState> {
    const state = this.toState(await this.request<LetterJson>("GET", `${this.base()}/${externalId}`));
    if (state.status === "action_required" || state.status === "failed") {
      try {
        const events = await this.request<{ data: { attributes: { code: string; name: string; data?: string[] } }[] }>("GET", `${this.base()}/${externalId}/events?language=fr-FR`);
        const last = events.data.at(-1)?.attributes;
        state.issue = last ? [last.name, ...(last.data ?? [])].filter(Boolean).join(" — ") : null;
      } catch {
        // détail indisponible
      }
    }
    return state;
  }

  async sendLetter(externalId: string, options: PostalOptions, idempotencyKey: string): Promise<PostalLetterState> {
    const json = await this.request<LetterJson>(
      "PATCH",
      `${this.base()}/${externalId}/send`,
      { data: { id: externalId, type: "letters", attributes: { delivery_product: options.deliveryProduct, print_mode: options.printMode, print_spectrum: options.printSpectrum } } },
      `send-${idempotencyKey}`,
    );
    return this.toState(json);
  }

  async cancelLetter(externalId: string) {
    await this.request("PATCH", `${this.base()}/${externalId}/cancel`);
  }

  /** En-tête « Signature » : HMAC-SHA256 hexadécimal du corps brut avec la clé de signature. */
  verifyWebhook(rawBody: string, signature: string | null): boolean {
    if (!this.cfg.webhookSecret || !signature) return false;
    const expected = Buffer.from(createHmac("sha256", this.cfg.webhookSecret).update(rawBody).digest("hex"));
    const given = Buffer.from(signature.trim().toLowerCase());
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async ping() {
    await this.accessToken();
  }
}
