import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test.describe("Annuaire et palette de commandes", () => {
  test("créer un ORL puis le retrouver par la recherche", async ({ page }) => {
    await login(page, ACCOUNTS.audio);
    await page.goto("/prescripteurs");
    await page.getByTestId("new-prescriber").click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#p-lastName").fill("Vasseur");
    await dialog.locator("#p-firstName").fill("Paul");
    await dialog.locator("#p-email").fill("p.vasseur@orl-test.test");
    await dialog.locator("#p-line1").fill("10 rue de la Paix");
    await dialog.locator("#p-cp").fill("75002");
    await dialog.locator("#p-city").fill("Paris");
    await dialog.getByRole("button", { name: "Ajouter à l'annuaire" }).click();
    await expect(dialog).toBeHidden();

    await page.getByTestId("prescriber-search").fill("vasseur");
    await expect(page.getByText(/VASSEUR/).first()).toBeVisible();
  });

  test("la palette (Ctrl+K) retrouve un patient", async ({ page }) => {
    await login(page, ACCOUNTS.audio);
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog");
    await expect(palette).toBeVisible();
    await page.keyboard.type("durand");
    await palette.getByRole("option", { name: /DURAND/ }).first().click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
  });
});
