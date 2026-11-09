/** Génère les bilans fictifs manquants dans demo/bilans (fichiers suivis par git). `--force` les regénère tous. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEMO_BILANS, renderDemoBilan } from "./bilans";

async function main() {
  const dir = path.resolve("demo/bilans");
  mkdirSync(dir, { recursive: true });
  const force = process.argv.includes("--force");
  for (const b of DEMO_BILANS) {
    const target = path.join(dir, b.file);
    if (!force && existsSync(target)) continue;
    writeFileSync(target, (await renderDemoBilan(b)).data);
    console.log(`✔ ${b.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
