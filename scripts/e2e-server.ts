/**
 * Serveur des tests E2E (lancé par Playwright) : base MongoDB embarquée éphémère,
 * données de démonstration, puis `next start` sur le build de production.
 * Hermétique : aucune variable de .env.local n'est lue et aucune clé de service n'est
 * transmise — tous les services externes sont simulés.
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const SERVICE_PREFIXES = ["ANTHROPIC_", "RESEND_", "PINGEN_", "S3_", "AWS_", "MONGODB_", "VERCEL"];
for (const key of Object.keys(process.env)) {
  if (SERVICE_PREFIXES.some((p) => key.startsWith(p))) delete process.env[key];
}

const port = process.env.E2E_PORT ?? "3200";
const storageDir = ".data/e2e-storage";
Object.assign(process.env, {
  APP_URL: `http://localhost:${port}`,
  BETTER_AUTH_SECRET: "e2e-secret-not-for-production-0123456789",
  CRON_SECRET: "e2e-cron-secret",
  DEMO_LOGIN_HINTS: "1",
  DISABLE_RATE_LIMIT: "1",
  LORL_MOCK_FAST: "1",
  LOCAL_STORAGE_DIR: storageDir,
  MONGODB_DB: "liaison-orl-e2e",
});

async function main() {
  if (!existsSync(".next/BUILD_ID")) throw new Error("Build absent : lancez `npm run build` avant les tests E2E.");
  rmSync(path.resolve(storageDir), { recursive: true, force: true });

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  for (const candidate of ["/opt/homebrew/bin/mongod", "/usr/local/bin/mongod", "/usr/bin/mongod"]) {
    if (!process.env.MONGOMS_SYSTEM_BINARY && existsSync(candidate)) process.env.MONGOMS_SYSTEM_BINARY = candidate;
  }
  const mongo = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
  process.env.MONGODB_URI = mongo.getUri();

  const { runSeed } = await import("./seed/run");
  await runSeed();
  const { closeDb } = await import("@/lib/db/client");
  await closeDb();
  console.log(`[e2e] base prête (${process.env.MONGODB_URI}), démarrage de l'application sur le port ${port}`);

  const child = spawn("npx", ["next", "start", "--port", port], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  const shutdown = async (code = 0) => {
    child.kill("SIGTERM");
    await mongo.stop();
    process.exit(code);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  child.on("exit", (code) => void shutdown(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
