/**
 * npm run db:indexes — crée (ou met à jour) les index MongoDB. Idempotent.
 * À lancer une fois après la création de la base de production, puis après chaque mise à jour.
 */
import { loadEnv } from "./lib/load-env";
loadEnv();

async function main() {
  const { mongoUri } = await import("@/lib/env");
  const { ensureIndexes } = await import("@/lib/db/indexes");
  const { closeDb } = await import("@/lib/db/client");
  await ensureIndexes();
  console.log(`Index à jour (${mongoUri().replace(/\/\/[^@]*@/, "//***@")}).`);
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
