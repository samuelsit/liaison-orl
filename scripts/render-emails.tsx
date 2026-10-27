/**
 * npm run render:emails [dossier] [--previews]
 *
 * Rend chaque e-mail (HTML + texte brut) dans /tmp/emails-preview et le capture avec
 * Playwright à 600 px et 375 px, en clair et en sombre. Avec --previews, copie les
 * captures (600 px clair et 375 px sombre) dans docs/previews/.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { emailFixtures } from "@/server/emails/fixtures";
import { renderEmail } from "@/server/emails/render";

const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith("--")) ?? "/tmp/emails-preview");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
try {
  for (const { name, subject, content } of emailFixtures()) {
    const { html, text } = await renderEmail(content);
    writeFileSync(path.join(out, `${name}.html`), html);
    writeFileSync(path.join(out, `${name}.txt`), `Objet : ${subject}\n\n${text}\n`);
    for (const width of [600, 375]) {
      for (const scheme of ["light", "dark"] as const) {
        const page = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: scheme });
        // Polices web non chargées hors ligne : la pile de repli (Helvetica/Arial) est vérifiée aussi.
        await page.setContent(html, { waitUntil: "load" });
        await page.screenshot({ path: path.join(out, `${name}-${width}-${scheme}.png`), fullPage: true });
        await page.close();
      }
    }
    console.log(`${name} — HTML ${Math.round(html.length / 1024)} Ko, texte ${text.split("\n").length} lignes`);
  }
} finally {
  await browser.close();
}

if (args.includes("--previews")) {
  const dest = path.resolve("docs/previews");
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(dest)) if (f.startsWith("email-")) rmSync(path.join(dest, f));
  for (const f of readdirSync(out))
    if (/-(600-light|375-dark)\.png$/.test(f)) copyFileSync(path.join(out, f), path.join(dest, `email-${f}`));
  console.log(`Captures copiées dans ${dest}`);
}
console.log(`\n${out}`);
