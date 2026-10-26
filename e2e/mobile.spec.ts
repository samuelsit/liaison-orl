import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, pickFromCombobox } from "./helpers";

test("mobile : accueil, menu et éditeur à onglets Formulaire / Aperçu", async ({ page }) => {
  await login(page, ACCOUNTS.audio);
  await expect(page.getByTestId("new-adressage")).toBeVisible();

  await page.getByRole("button", { name: "Afficher ou masquer le menu" }).click();
  await expect(page.getByRole("link", { name: /Annuaire ORL/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("new-adressage").click();
  await page.waitForURL(/\/documents\/[^/]+$/);
  await expect(page.getByRole("tab", { name: "Formulaire" })).toBeVisible();
  await pickFromCombobox(page, "patient-combobox", "martin", /Robert MARTIN/);
  await page.getByRole("tab", { name: "Aperçu" }).click();
  await expect(page.getByTestId("pdf-preview")).toBeVisible();

  // Aucune barre de défilement horizontale.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile : aucune page principale ne déborde horizontalement", async ({ page }) => {
  await login(page, ACCOUNTS.audio);
  for (const url of ["/", "/documents", "/envois", "/prescripteurs", "/patients", "/compte"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, url).toBeLessThanOrEqual(1);
  }
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("new-compte_rendu").click();
  await page.waitForURL(/\/documents\/[^/]+$/);
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "éditeur CR").toBeLessThanOrEqual(1);
});
