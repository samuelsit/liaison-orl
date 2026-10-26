import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Authentification", () => {
  test("une page protégée redirige vers la connexion", async ({ page }) => {
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/connexion/);
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("un mauvais mot de passe affiche une erreur claire", async ({ page }) => {
    await page.goto("/connexion");
    await page.locator("#email").fill(ACCOUNTS.audio);
    await page.locator("#password").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /incorrect|invalide/i })).toBeVisible();
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("l'administratrice doit saisir son code de double authentification", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  });

  test("un audioprothésiste n'accède pas à l'administration", async ({ page }) => {
    await login(page, ACCOUNTS.audio);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
