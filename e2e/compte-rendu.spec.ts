import path from "node:path";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, BILANS_DIR, choose, login, pickFromCombobox, validateDocument } from "./helpers";

test("compte rendu : bilan lu par l'IA, correction, commentaire, validation, envoi e-mail + courrier", async ({ page }) => {
  await login(page, ACCOUNTS.audio);

  await page.getByTestId("new-compte_rendu").click();
  await page.waitForURL(/\/documents\/[^/]+$/);
  await pickFromCombobox(page, "patient-combobox", "durand", /Jeanne DURAND/);
  await expect(page.getByTestId("prescriber-combobox")).toContainText("GARNIER", { ignoreCase: true });

  // Dépôt du bilan → extraction → tableau de correction.
  await page.getByTestId("bilan-input").setInputFiles(path.join(BILANS_DIR, "bilan-durand-jeanne.pdf"));
  await expect(page.getByTestId("confirm-measures")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: /audiogramme/i }).first()).toBeVisible();
  await page.getByTestId("confirm-measures").click();

  // Pré-remplissage (degré, oreilles) et commentaire rédigé, marqués « suggéré par l'IA ».
  await expect(page.getByTestId("ai-badge").first()).toBeVisible();
  await expect(page.locator("#comments")).not.toHaveValue("", { timeout: 20_000 });

  await choose(page, "2. Écouteur déporté");
  await choose(page, "Signia");
  await page.locator("#deviceModel").fill("Pure Charge&Go IX 7");
  await page.locator("#price").fill("1450");
  await choose(page, "2", true);

  await validateDocument(page);

  await page.getByTestId("prepare-send").click();
  await page.waitForURL(/\/envoi$/);
  // Prescripteur « e-mail + courrier » : les deux canaux sont proposés, avec le coût estimé.
  await expect(page.getByTestId("channel-EMAIL")).toHaveAttribute("aria-checked", "true");
  const postal = page.getByTestId("channel-COURRIER");
  if ((await postal.getAttribute("aria-checked")) !== "true") await postal.click();
  await expect(page.getByText(/€/).first()).toBeVisible();
  await page.getByTestId("send").click();
  await expect(page.getByText("Envoi effectué")).toBeVisible({ timeout: 30_000 });

  await page.goto("/envois");
  await expect(page.getByText(/DURAND/).first()).toBeVisible();
});
