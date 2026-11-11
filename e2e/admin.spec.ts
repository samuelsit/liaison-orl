import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Administration", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin);
  });

  test("toutes les pages d'administration s'affichent", async ({ page }) => {
    const pages: [string, RegExp][] = [
      ["/admin", /Administration/],
      ["/admin/marque", /Marque/],
      ["/admin/centres", /Centres/],
      ["/admin/utilisateurs", /Utilisateurs/],
      ["/admin/annuaire", /Annuaire|Doublons/],
      ["/admin/modeles", /Modèles/],
      ["/admin/envois", /Envois|envoi/],
      ["/admin/statistiques", /Statistiques/],
      ["/admin/audit", /Journal/],
      ["/admin/conservation", /Conservation/],
      ["/admin/services", /Services/],
      ["/admin/boite-demo", /Boîte/],
    ];
    for (const [url, text] of pages) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
      await expect(page.getByRole("main").getByText(text).first(), url).toBeVisible();
    }
  });

  test("le bandeau « Mode démo » signale les services simulés", async ({ page }) => {
    await page.goto("/admin/services");
    await expect(page.getByText(/Mode démo/i).first()).toBeVisible();
  });

  test("inviter un utilisateur envoie une invitation (boîte de démonstration)", async ({ page }) => {
    await page.goto("/admin/utilisateurs");
    await page.getByTestId("invite-user").click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#u-first").fill("Hugo");
    await dialog.locator("#u-last").fill("Lambert");
    await dialog.locator("#u-email").fill("hugo.lambert@demo.test");
    await dialog.getByRole("checkbox").first().click();
    await dialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("hugo.lambert@demo.test")).toBeVisible();
    await page.goto("/admin/boite-demo");
    await expect(page.getByText("hugo.lambert@demo.test").first()).toBeVisible();
  });

  test("la vue « Tous les centres » donne une vue d'ensemble et demande le centre d'un nouveau document", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("centre-select").click();
    await page.getByRole("option", { name: /Tous les centres/ }).click();
    const overview = page.getByTestId("centre-overview");
    await expect(overview).toBeVisible();
    await expect(page.getByTestId("centre-select")).toContainText("Tous les centres");
    const rows = overview.getByRole("listitem");
    await expect(rows).toHaveCount(11);

    // Nouvel adressage : le centre est demandé, puis l'éditeur s'ouvre sur un brouillon de ce centre.
    const centreName = (await rows.nth(1).locator("span.truncate").first().textContent())!.trim();
    await page.getByTestId("new-adressage").click();
    const picker = page.getByTestId("centre-picker");
    await expect(picker.getByRole("heading", { name: "Pour quel centre ?" })).toBeVisible();
    await picker.getByRole("option", { name: centreName, exact: true }).click();
    await page.waitForURL(/\/documents\/[^/]+$/);
    await page.goto("/documents?statut=BROUILLON");
    await expect(page.getByRole("main").getByText(centreName).first()).toBeVisible();

    // Un clic sur un centre de la carte ouvre la vue de ce centre.
    await page.goto("/");
    await page.getByTestId("centre-overview").getByRole("listitem").nth(1).getByRole("button").click();
    await expect(page.getByTestId("centre-overview")).toBeHidden();
    await expect(page.getByTestId("centre-select")).toContainText(centreName);
  });

  test("le journal d'audit trace les actions et s'exporte en CSV", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("table")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Exporter|CSV/ }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
