/**
 * npm run seed — réinitialise la base de démonstration avec des données fictives.
 * Refuse de s'exécuter sur une base de production réelle.
 */
import { loadEnv } from "./lib/load-env";
// Le seed n'appelle jamais de service réel hérité du shell (données fictives, mode démo).
loadEnv({ onlyFileServiceKeys: true });

async function main() {
  const { isLiveProduction, mongoUri } = await import("@/lib/env");
  const force = process.argv.includes("--force");
  if (isLiveProduction() && !force) {
    console.error("Refus : le seed de démonstration ne s'exécute pas en production (utilisez --force en connaissance de cause).");
    process.exit(1);
  }
  const { runSeed } = await import("./seed/run");
  const summary = await runSeed({ force });
  console.log(`\nBase de démonstration prête (${mongoUri().replace(/\/\/[^@]*@/, "//***@")}).`);
  console.table(summary.counts);
  console.log("\nComptes de démonstration (mot de passe : " + summary.password + ") :");
  for (const a of summary.accounts) console.log(`  · ${a.email.padEnd(28)} ${a.role}`);
  console.log(`\nSecret TOTP de l'administrateur (à saisir dans une application d'authentification) : ${summary.totpBase32}`);
  console.log(`Bilans auditifs fictifs à glisser dans l'application : ${summary.bilansDir}`);
  const { closeDb } = await import("@/lib/db/client");
  await closeDb();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
