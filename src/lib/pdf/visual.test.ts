import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { pdfFixtures } from "./fixtures";
import { variantsFor } from "./model";
import { renderPdf } from "./render";

/**
 * Non-régression visuelle des PDF : chaque page est rendue en PNG (pdftoppm, 50 dpi)
 * et comparée à la référence de tests/visual/pdf/ avec une tolérance (anticrénelage).
 * Une référence absente est créée ; UPDATE_SNAPSHOTS=1 régénère toutes les références.
 * Test ignoré si pdftoppm (poppler) n'est pas installé.
 */
const BASELINE_DIR = path.resolve("tests/visual/pdf");
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";
/** Part maximale de pixels différents (écart > 48 sur un canal). */
const MAX_DIFF_RATIO = 0.004;

const hasPdftoppm = (() => {
  try {
    execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const work = mkdtempSync(path.join(tmpdir(), "pdf-visual-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

async function diffRatio(a: string, b: string): Promise<number> {
  const [ra, rb] = await Promise.all([
    sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) return 1;
  let diff = 0;
  for (let i = 0; i < ra.data.length; i += 3) {
    if (
      Math.abs(ra.data[i]! - rb.data[i]!) > 48 ||
      Math.abs(ra.data[i + 1]! - rb.data[i + 1]!) > 48 ||
      Math.abs(ra.data[i + 2]! - rb.data[i + 2]!) > 48
    )
      diff++;
  }
  return diff / (ra.data.length / 3);
}

describe.skipIf(!hasPdftoppm)("non-régression visuelle des PDF", async () => {
  mkdirSync(BASELINE_DIR, { recursive: true });
  for (const { name, model } of await pdfFixtures()) {
    for (const variant of variantsFor(model.type)) {
      const base = `${name}-${variant === "standard" ? "email" : "postal"}`;
      it(base, async () => {
        const { buffer } = await renderPdf(model, variant);
        const pdf = path.join(work, `${base}.pdf`);
        writeFileSync(pdf, buffer);
        execFileSync("pdftoppm", ["-r", "50", "-png", pdf, path.join(work, base)]);
        const pages = readdirSync(work)
          .filter((f) => f.startsWith(`${base}-`) && f.endsWith(".png"))
          .sort();
        expect(pages.length).toBeGreaterThan(0);
        for (const page of pages) {
          const baseline = path.join(BASELINE_DIR, page);
          if (UPDATE || !existsSync(baseline)) {
            await sharp(path.join(work, page)).png({ compressionLevel: 9, palette: true }).toFile(baseline);
            continue;
          }
          expect(await diffRatio(path.join(work, page), baseline), `${page} diffère de la référence`).toBeLessThan(
            MAX_DIFF_RATIO,
          );
        }
        // Une page de référence en trop signale un document devenu plus court.
        const expected = readdirSync(BASELINE_DIR).filter(
          (f) => f.startsWith(`${base}-`) && /^\d+\.png$/.test(f.slice(base.length + 1)),
        );
        expect(expected.length).toBe(pages.length);
      });
    }
  }
});
