import "server-only";
import { env, pingenEnvironment } from "@/lib/env";
import { MockPostalProvider } from "./mock";
import { PingenProvider } from "./pingen";
import type { PostalProvider } from "./types";

let instance: PostalProvider | null = null;

export function postalProvider(): PostalProvider {
  if (instance) return instance;
  const e = env();
  instance =
    e.PINGEN_CLIENT_ID && e.PINGEN_CLIENT_SECRET && e.PINGEN_ORGANISATION_ID
      ? new PingenProvider({
          clientId: e.PINGEN_CLIENT_ID,
          clientSecret: e.PINGEN_CLIENT_SECRET,
          organisationId: e.PINGEN_ORGANISATION_ID,
          environment: pingenEnvironment(),
          webhookSecret: e.PINGEN_WEBHOOK_SECRET,
        })
      : new MockPostalProvider();
  return instance;
}

export function setPostalProvider(p: PostalProvider | null) {
  instance = p;
}

export type { PostalProvider, PostalOptions, PostalLetterState } from "./types";
export { PostalError } from "./types";
