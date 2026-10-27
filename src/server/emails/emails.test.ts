import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "@playwright/test";
import { emailFixtures } from "./fixtures";
import { renderEmail } from "./render";

const fixtures = emailFixtures();
const rendered = await Promise.all(fixtures.map(async (f) => ({ ...f, ...(await renderEmail(f.content)) })));

describe("gabarits d'e-mails", () => {
  for (const e of rendered) {
    it(`${e.name} : structure, accessibilité, texte brut`, () => {
      expect(e.html).toMatch(/<html[^>]*lang="fr"/);
      expect(e.html).toContain('name="color-scheme"');
      expect(e.html).toContain("fonts.googleapis.com/css2?family=Inter");
      expect(e.html).toMatch(/<img[^>]*alt="Harmonie Audition"[^>]*width="\d+"/);
      expect(e.html).toContain("prefers-color-scheme: dark");
      // Préheader présent (texte masqué en tête).
      expect(e.html).toMatch(/display:none[^>]*>[^<]{10,}/);
      expect(e.text.length).toBeGreaterThan(80);
      expect(e.text).not.toMatch(/<[a-z]/i);
    });
  }

  it("bouton principal compatible Outlook (VML) avec cible d'au moins 44 px", () => {
    const doc = rendered.find((e) => e.name === "document-lien-securise")!;
    expect(doc.html).toContain("v:roundrect");
    expect(doc.html).toMatch(/height:48px/);
    expect(doc.html).toContain("Consulter le document");
    expect(doc.text).toContain("Consulter le document : https://");
  });

  it("e-mail du lien sécurisé : validité, marche à suivre, aucune information médicale", () => {
    const doc = rendered.find((e) => e.name === "document-lien-securise")!;
    expect(doc.html).toContain("26 novembre 2026");
    expect(doc.html).toMatch(/Lien expiré ou inaccessible/);
    // Le logo des exemples est embarqué en base64 : on ne contrôle que le texte.
    const visible = doc.html.replace(/data:[^"')]+/g, "");
    expect(visible).not.toMatch(/surdité|audiogramme|1948|Jeanne|Signia|\bdB\b/i);
    expect(doc.text).not.toMatch(/surdité|audiogramme|1948|Jeanne|Signia|\bdB\b/i);
    expect(doc.subject).toBe("Compte rendu d'appareillage — Mme J. DUPONT");
  });

  it("variante pièce jointe sans lien", () => {
    const doc = rendered.find((e) => e.name === "document-piece-jointe")!;
    expect(doc.html).not.toContain("v:roundrect");
    expect(doc.html).toContain("joint à ce message");
  });
});

/**
 * Non-régression visuelle : captures Chromium (600 px clair, 375 px sombre) comparées aux
 * références de tests/visual/emails/. Une référence absente est créée ; UPDATE_SNAPSHOTS=1
 * les régénère. Ignoré si le navigateur de Playwright n'est pas installé.
 */
const BASELINE_DIR = path.resolve("tests/visual/emails");
let browser: Browser | null = null;
beforeAll(async () => {
  browser = await chromium.launch().catch(() => null);
});
afterAll(async () => {
  await browser?.close();
});

async function diffRatio(a: Buffer, b: Buffer): Promise<number> {
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

describe("non-régression visuelle des e-mails", () => {
  mkdirSync(BASELINE_DIR, { recursive: true });
  for (const e of rendered) {
    for (const [width, scheme] of [
      [600, "light"],
      [375, "dark"],
    ] as const) {
      it(`${e.name} — ${width} px, ${scheme === "light" ? "clair" : "sombre"}`, async (ctx) => {
        if (!browser) return ctx.skip();
        const page = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: scheme });
        // Polices web bloquées : rendu déterministe avec la pile de repli.
        await page.route("**/*", (route) =>
          route.request().url().startsWith("data:") ? route.continue() : route.abort(),
        );
        await page.setContent(e.html, { waitUntil: "load" });
        const shot = await page.screenshot({ fullPage: true });
        await page.close();
        const file = path.join(BASELINE_DIR, `${e.name}-${width}-${scheme}.png`);
        if (process.env.UPDATE_SNAPSHOTS === "1" || !existsSync(file)) {
          await sharp(shot).png({ compressionLevel: 9, palette: true }).toFile(file);
          return;
        }
        expect(await diffRatio(shot, await sharp(file).toBuffer())).toBeLessThan(0.004);
      });
    }
  }
});
