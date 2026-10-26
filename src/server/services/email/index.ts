import "server-only";
import { env } from "@/lib/env";
import { MockEmailProvider } from "./mock";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

let instance: EmailProvider | null = null;

export function emailProvider(): EmailProvider {
  if (instance) return instance;
  const key = env().RESEND_API_KEY;
  instance = key ? new ResendEmailProvider(key) : new MockEmailProvider();
  return instance;
}

export function resetEmailProvider() {
  instance = null;
}

export function setEmailProvider(p: EmailProvider | null) {
  instance = p;
}

export type { EmailProvider, OutgoingEmail } from "./types";
