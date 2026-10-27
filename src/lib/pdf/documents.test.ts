import { describe, expect, it } from "vitest";
import { pdfFixtures, type PdfFixture } from "./fixtures";
import { postalAddress } from "./address";
import { checkPingenZones, describeViolation, inspectPdf, type PageInk } from "./inspect";
import { renderPdf } from "./render";
import { PINGEN_ZONES, intersects } from "./zones";

const fixtures = await pdfFixtures();
const byName = (name: string) => fixtures.find((f) => f.name === name)!;

async function textOf(pages: PageInk[]): Promise<string> {
  return pages.flatMap((p) => p.boxes.filter((b) => b.kind === "text").map((b) => b.label)).join(" ");
}

function addressOf(f: PdfFixture) {
  const p = f.model.prescriber!;
  return postalAddress(
    {
      civility: p.civility,
      firstName: p.firstName,
      lastName: p.lastName,
      practiceName: p.practiceName,
      address: p.address,
    },
    f.model.brand.font,
  );
}

describe("zones Pingen (boîtes englobantes extraites avec pdf.js)", () => {
  for (const f of fixtures) {
    for (const variant of ["standard", "postal"] as const) {
      it(`${f.name} — version ${variant === "postal" ? "postale" : "e-mail"}`, async () => {
        const address = addressOf(f);
        expect(address.errors).toEqual([]);
        const { buffer } = await renderPdf(f.model, variant);
        const pages = await inspectPdf(buffer);
        const violations = checkPingenZones(pages, { postal: variant === "postal", addressLines: address.lines });
        expect(violations.map(describeViolation)).toEqual([]);
        // Coin DMC (haut droite) vide sur chaque page, dans toutes les versions.
        for (const page of pages) expect(page.boxes.filter((b) => intersects(b, PINGEN_ZONES.dmcGuard))).toEqual([]);
      });
    }
  }

  it("détecte un élément dans la zone d'affranchissement (le contrôle n'est pas complaisant)", async () => {
    const { buffer } = await renderPdf(byName("adressage").model, "standard");
    const violations = checkPingenZones(await inspectPdf(buffer), {
      postal: true,
      addressLines: addressOf(byName("adressage")).lines,
    });
    expect(violations.some((v) => v.rule.includes("affranchissement"))).toBe(true);
  });
});

describe("contenu des documents", () => {
  it("n'affiche que l'information renseignée (aucune case ni ligne vide)", async () => {
    const minimal = await textOf(await inspectPdf((await renderPdf(byName("adressage-minimal").model)).buffer));
    expect(minimal).toContain("Vérification des conduits auditifs externes");
    expect(minimal).not.toContain("Bilan auditif");
    const empty = await textOf(await inspectPdf((await renderPdf(byName("compte-rendu-vide").model)).buffer));
    expect(empty).not.toMatch(/ÉQUIPEMENT|Équipement|SUIVI|COMMENTAIRE|Gain/i);
  });

  it("imprime l'objet, la formule d'appel du prescripteur, la signature et la pagination", async () => {
    const pages = await inspectPdf((await renderPdf(byName("compte-rendu").model)).buffer);
    const text = await textOf(pages);
    expect(text).toMatch(/Objet\s*:\s*Compte rendu d’appareillage — Mme Jeanne DUPONT, née\sle\s12\/03\/1948/);
    expect(text).toContain("Cher Confrère,");
    expect(text).toContain("RPPS 10101234567");
    expect(text).toContain(`1/${pages.length}`);
    expect(pages[0]!.boxes.some((b) => b.kind === "image")).toBe(true);
  });

  it("garde tous les glyphes d'un document à l'autre (régression : « A » Medium perdu après « À »)", async () => {
    await renderPdf(byName("adressage").model, "standard");
    const text = await textOf(await inspectPdf((await renderPdf(byName("compte-rendu").model)).buffer));
    expect(text).toContain("Avec appareils (dB HL)");
  });

  it("supporte des rendus simultanés", async () => {
    const results = await Promise.all(fixtures.slice(0, 4).map((f) => renderPdf(f.model, "postal")));
    for (const r of results) expect(r.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
