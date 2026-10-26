import { z } from "zod";

/**
 * Variables d'environnement validées. Chaque service externe bascule
 * automatiquement en mode « démo » (mock) si sa clé est absente.
 * Aucune valeur de marque ici : tout ce qui est visible vient de la base.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: optional,
  VERCEL_URL: optional,
  VERCEL_ENV: optional,
  VERCEL: optional,

  MONGODB_URI: optional,
  MONGODB_DB: optional,

  BETTER_AUTH_SECRET: optional,

  ANTHROPIC_API_KEY: optional,
  AI_MODEL_VISION: z.string().default("claude-sonnet-5-5"),
  AI_MODEL_TEXT: z.string().default("claude-haiku-5-5"),
  AI_INFERENCE_GEO: optional,

  RESEND_API_KEY: optional,
  RESEND_WEBHOOK_SECRET: optional,
  EMAIL_FROM_DOMAIN: optional,
  EMAIL_FROM_ADDRESS: optional,

  PINGEN_CLIENT_ID: optional,
  PINGEN_CLIENT_SECRET: optional,
  PINGEN_ORGANISATION_ID: optional,
  PINGEN_ENV: z.enum(["staging", "production"]).optional(),
  PINGEN_WEBHOOK_SECRET: optional,

  S3_BUCKET: optional,
  S3_REGION: z.string().default("eu-west-3"),
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  S3_ENDPOINT: optional,

  LOCAL_STORAGE_DIR: z.string().default(".data/storage"),
  CRON_SECRET: optional,
  DEMO_LOGIN_HINTS: optional,
  DISABLE_RATE_LIMIT: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

/** Réinitialise le cache (tests). */
export function resetEnvCache() {
  cached = null;
}

export function isProduction() {
  return env().NODE_ENV === "production";
}

/** Déploiement de production réel (et non une préproduction Vercel). */
export function isLiveProduction() {
  const e = env();
  if (e.NODE_ENV !== "production") return false;
  if (e.VERCEL && e.VERCEL_ENV !== "production") return false;
  return true;
}

export function appUrl(): string {
  const e = env();
  if (e.APP_URL) return e.APP_URL.replace(/\/$/, "");
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function mongoUri(): string {
  const e = env();
  if (e.MONGODB_URI) return e.MONGODB_URI;
  if (e.NODE_ENV === "production") {
    throw new Error("MONGODB_URI est obligatoire en production.");
  }
  return "mongodb://127.0.0.1:27027/liaison-orl";
}

export function mongoDbName(): string {
  const e = env();
  if (e.MONGODB_DB) return e.MONGODB_DB;
  try {
    const path = new URL(mongoUri()).pathname.replace(/^\//, "");
    if (path) return path;
  } catch {
    // URI non standard : on garde le nom par défaut.
  }
  return "liaison-orl";
}

const DEV_SECRET = "dev-secret-ne-pas-utiliser-en-production-0123456789";

export function authSecret(): string {
  const e = env();
  if (e.BETTER_AUTH_SECRET) return e.BETTER_AUTH_SECRET;
  if (e.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET est obligatoire en production.");
  }
  return DEV_SECRET;
}

export type ServiceMode = "live" | "mock";

export interface ServiceModes {
  ai: ServiceMode;
  email: ServiceMode;
  postal: ServiceMode;
  storage: ServiceMode;
}

export function serviceModes(): ServiceModes {
  const e = env();
  return {
    ai: e.ANTHROPIC_API_KEY ? "live" : "mock",
    email: e.RESEND_API_KEY ? "live" : "mock",
    postal: e.PINGEN_CLIENT_ID && e.PINGEN_CLIENT_SECRET && e.PINGEN_ORGANISATION_ID ? "live" : "mock",
    storage: e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY ? "live" : "mock",
  };
}

export function isDemoMode(): boolean {
  const m = serviceModes();
  return Object.values(m).some((v) => v === "mock");
}

/**
 * Environnement Pingen : la production n'est utilisée QUE si elle est demandée
 * explicitement ET que l'application tourne en production réelle.
 */
export function pingenEnvironment(): "staging" | "production" {
  const e = env();
  if (e.PINGEN_ENV === "production" && isLiveProduction()) return "production";
  return "staging";
}

/**
 * Désactivation de la limitation de débit (tests E2E uniquement). Toujours ignorée sur
 * le déploiement de production Vercel, même si la variable y est définie par erreur.
 */
export function rateLimitDisabled(): boolean {
  const e = env();
  return e.DISABLE_RATE_LIMIT === "1" && e.VERCEL_ENV !== "production";
}

/** Affiche les comptes de démonstration et le code TOTP de démo sur les écrans de connexion. */
export function showDemoLoginHints(): boolean {
  const e = env();
  if (e.DEMO_LOGIN_HINTS === "1") return true;
  if (e.DEMO_LOGIN_HINTS === "0") return false;
  return e.NODE_ENV === "development";
}
