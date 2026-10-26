import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/** Clés des services externes : présentes = mode réel (et potentiellement payant). */
export const SERVICE_KEYS = ["ANTHROPIC_API_KEY", "RESEND_API_KEY", "PINGEN_CLIENT_ID", "PINGEN_CLIENT_SECRET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];

/**
 * Charge .env.local puis .env (comme Next.js) pour les scripts en ligne de commande.
 * `onlyFileServiceKeys` : ignore les clés de service héritées du shell si elles ne
 * figurent pas dans ces fichiers (une clé personnelle ne fait pas basculer la démo en réel).
 */
export function loadEnv(opts: { onlyFileServiceKeys?: boolean } = {}) {
  const files = [".env.local", ".env"].filter((f) => existsSync(f));
  if (opts.onlyFileServiceKeys) {
    const declared = new Set(files.flatMap((f) => Object.keys(parseEnv(readFileSync(f, "utf8")))));
    for (const k of SERVICE_KEYS) if (!declared.has(k)) delete process.env[k];
  }
  for (const file of files) process.loadEnvFile(file);
}
