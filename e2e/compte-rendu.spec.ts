import path from "node:path";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, BILANS_DIR, choose, login, pickFromCombobox, validateDocument } from "./helpers";

test("compte rendu : bilan lu par l'IA, correction, commentaire, validation, envoi e-mail + courrier et lien sécurisé", async ({ page, context }) => {
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

  await page.locator("li").filter({ hasText: /^E-mail/ }).getByRole("link", { name: "suivi" }).click();
  await page.waitForURL(/\/envois\/[^/]+$/);
  const mail = page.frameLocator("iframe[title=\"Aperçu de l'e-mail simulé\"]");
  const href = await mail.getByRole("link", { name: "Consulter le document" }).getAttribute("href");
  expect(href).toMatch(/\/l\/[\w-]+$/);
  const linkPath = new URL(href!).pathname;

  // Côté médecin : lien sécurisé, second facteur = date de naissance du patient.
  const doctor = await context.browser()!.newContext({ viewport: { width: 400, height: 800 } });
  const p2 = await doctor.newPage();
  await p2.goto(linkPath);
  await expect(p2.getByText("DURAND")).toHaveCount(0);
  await p2.locator("#valeur").fill("01/01/1950");
  await p2.getByRole("button", { name: "Accéder au document" }).click();
  await expect(p2.getByRole("alert").first()).toContainText(/incorrect|essai/i);
  await p2.locator("#valeur").fill("12/03/1946");
  await p2.getByRole("button", { name: "Accéder au document" }).click();
  await expect(p2.getByRole("link", { name: "Ouvrir le PDF" })).toBeVisible();
  const pdf = await p2.request.get(`${linkPath}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await doctor.close();

  // L'ouverture remonte dans le suivi.
  await page.reload();
  await expect(page.getByText(/Ouvert/).first()).toBeVisible();

  await page.goto("/envois");
  await expect(page.getByText(/DURAND/).first()).toBeVisible();
});
