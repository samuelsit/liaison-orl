/**
 * npm run demo — lance l'application en mode démonstration sans aucune installation :
 * base MongoDB locale embarquée et persistante (.data/mongo), seed automatique au
 * premier lancement, puis `next dev`.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "./lib/load-env";

// Le mode démo n'utilise que les clés déclarées dans .env.local / .env.
loadEnv({ onlyFileServiceKeys: true });

const PORT = 27027;

async function startEmbeddedMongo(): Promise<{ uri: string; stop: () => Promise<void> }> {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  for (const candidate of ["/opt/homebrew/bin/mongod", "/usr/local/bin/mongod", "/usr/bin/mongod"]) {
    if (!process.env.MONGOMS_SYSTEM_BINARY && existsSync(candidate)) process.env.MONGOMS_SYSTEM_BINARY = candidate;
  }
  const dbPath = path.resolve(".data/mongo");
  mkdirSync(dbPath, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: PORT, dbPath, storageEngine: "wiredTiger", ip: "127.0.0.1" },
  });
  return { uri: server.getUri("liaison-orl"), stop: async () => void (await server.stop({ doCleanup: false })) };
}

async function main() {
  let stop: (() => Promise<void>) | null = null;
  if (!process.env.MONGODB_URI) {
    console.log("▶ Démarrage de la base MongoDB locale de démonstration (.data/mongo)…");
    const mongo = await startEmbeddedMongo();
    process.env.MONGODB_URI = mongo.uri;
    stop = mongo.stop;
  }

  const { collections } = await import("@/lib/db/collections");
  const hasData = (await collections().organizations().countDocuments()) > 0;
  if (!hasData || process.argv.includes("--reset")) {
    console.log("▶ Création des données de démonstration…");
    const { runSeed } = await import("./seed/run");
    const summary = await runSeed();
    console.table(summary.counts);
  }
  const { closeDb } = await import("@/lib/db/client");
  await closeDb();

  // Le port et APP_URL doivent concorder (Better Auth refuse les autres origines).
  const appUrlPort = process.env.APP_URL ? new URL(process.env.APP_URL).port : "";
  const port = process.env.PORT ?? (appUrlPort || "3000");
  if (!process.env.APP_URL || appUrlPort !== port) process.env.APP_URL = `http://localhost:${port}`;
  console.log(`▶ Application : ${process.env.APP_URL}  (comptes de démonstration affichés sur l'écran de connexion)`);
  const child = spawn("npx", ["next", "dev", "--port", port], { stdio: "inherit", env: process.env });
  const shutdown = async () => {
    child.kill("SIGINT");
    if (stop) await stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  child.on("exit", async (code) => {
    if (stop) await stop();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
