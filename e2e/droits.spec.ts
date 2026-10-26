import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, pickFromCombobox } from "./helpers";

test.describe("Droits", () => {
  test("une assistante sans droit d'envoi prépare un brouillon mais ne peut ni valider ni envoyer", async ({ page }) => {
    await login(page, ACCOUNTS.assistant);
    await page.getByTestId("new-adressage").click();
    await page.waitForURL(/\/documents\/[^/]+$/);
    await pickFromCombobox(page, "patient-combobox", "durand", /Jeanne DURAND/);
    await page.getByTestId("exam-conduits").click();
    await expect(page.getByTestId("save-state")).toContainText(/enregistr/i);
    await expect(page.getByTestId("validate")).toHaveCount(0);
    await expect(page.getByText("Brouillon prêt pour validation par un audioprothésiste")).toBeVisible();

    // Un document validé d'un autre utilisateur : pas de bouton d'envoi, page d'envoi refusée.
    await page.goto("/documents?statut=VALIDE");
    const firstDoc = page.locator("a[href^='/documents/']").filter({ hasNotText: "Nouveau" }).first();
    const href = await firstDoc.getAttribute("href");
    if (href) {
      await page.goto(href);
      await expect(page.getByTestId("prepare-send")).toHaveCount(0);
      await page.goto(`${href}/envoi`);
      await expect(page.getByTestId("send")).toHaveCount(0);
    }
  });

  test("les API refusent les requêtes non authentifiées", async ({ request }) => {
    for (const url of ["/api/documents/inexistant/pdf", "/api/pieces-jointes/inexistant", "/api/admin/audit", "/api/admin/statistiques"]) {
      const res = await request.get(url, { maxRedirects: 0 });
      expect([401, 403, 307, 404], url).toContain(res.status());
      expect(res.headers()["content-type"] ?? "").not.toContain("application/pdf");
    }
  });
});
