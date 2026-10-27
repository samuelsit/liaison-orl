/**
 * npm run render:docs [dossier] [--previews]
 *
 * Génère tous les PDF envoyés (version e-mail et version postale, cas nominaux et cas
 * limites) dans /tmp/docs-preview, une version « debug » avec les zones Pingen
 * superposées, les convertit en PNG (pdftoppm, 150 dpi) et contrôle les zones Pingen.
 * Avec --previews, copie les captures de référence dans docs/previews/.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pdfFixtures } from "@/lib/pdf/fixtures";
import { postalAddress } from "@/lib/pdf/address";
import { checkPingenZones, describeViolation, inspectPdf } from "@/lib/pdf/inspect";
import { renderPdf } from "@/lib/pdf/render";

const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith("--")) ?? "/tmp/docs-preview");
const copyPreviews = args.includes("--previews");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let hasPdftoppm = true;
try {
  execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
} catch {
  hasPdftoppm = false;
  console.warn("pdftoppm introuvable (paquet poppler) : PDF générés sans conversion PNG.");
}

let failures = 0;
for (const { name, model } of await pdfFixtures()) {
  const lines = model.prescriber
    ? postalAddress({ ...model.prescriber, practiceName: model.prescriber.practiceName }, model.brand.font)
    : { lines: [], errors: ["Aucun prescripteur"], warnings: [] };
  for (const variant of ["standard", "postal"] as const) {
    if (variant === "postal" && lines.errors.length) {
      console.log(`${name}-postal — envoi postal bloqué : ${lines.errors.join(" ")}`);
      continue;
    }
    const base = `${name}-${variant === "standard" ? "email" : "postal"}`;
    const { buffer, info } = await renderPdf(model, variant);
    writeFileSync(path.join(out, `${base}.pdf`), buffer);
    const violations = checkPingenZones(await inspectPdf(buffer), {
      postal: variant === "postal",
      addressLines: lines.lines,
    });
    failures += violations.length;
    console.log(
      `${base}.pdf — ${info.pages} page(s) — ${violations.length ? `${violations.length} problème(s) de zone` : "zones Pingen OK"}`,
    );
    for (const v of violations) console.log(`   ✗ ${describeViolation(v)}`);
    if (lines.warnings.length && variant === "postal") console.log(`   ! ${lines.warnings.join(" ")}`);
    if (hasPdftoppm)
      execFileSync("pdftoppm", ["-r", "150", "-png", path.join(out, `${base}.pdf`), path.join(out, base)]);
    if (variant === "postal") {
      const debug = await renderPdf(model, variant, { debugZones: true });
      writeFileSync(path.join(out, `${base}-debug.pdf`), debug.buffer);
      if (hasPdftoppm)
        execFileSync("pdftoppm", [
          "-r",
          "150",
          "-png",
          path.join(out, `${base}-debug.pdf`),
          path.join(out, `${base}-debug`),
        ]);
    }
  }
}

if (copyPreviews && hasPdftoppm) {
  const dest = path.resolve("docs/previews");
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(dest)) if (f.endsWith(".png") && !f.startsWith("email-")) rmSync(path.join(dest, f));
  for (const f of readdirSync(out)) if (f.endsWith(".png")) copyFileSync(path.join(out, f), path.join(dest, f));
  console.log(`Captures copiées dans ${dest}`);
}

console.log(`\n${out}`);
if (failures) {
  console.error(`${failures} élément(s) dans une zone Pingen interdite.`);
  process.exit(1);
}
