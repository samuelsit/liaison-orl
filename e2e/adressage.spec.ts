import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, pickFromCombobox, validateDocument } from "./helpers";

test("adressage : création, motif reformulé par l'IA, validation, envoi e-mail et lien sécurisé", async ({ page, context }) => {
  await login(page, ACCOUNTS.audio);

  await page.getByTestId("new-adressage").click();
  await page.waitForURL(/\/documents\/[^/]+$/);
  await pickFromCombobox(page, "patient-combobox", "martin", /Robert MARTIN/);
  // Le prescripteur habituel du patient est proposé automatiquement.
  await expect(page.getByTestId("prescriber-combobox")).toContainText("LEFÈVRE", { ignoreCase: true });

  await page.getByTestId("exam-bilan").click();
  await page.getByTestId("exam-autre").click();
  await page.locator("#autreText").fill("bouchon cerumen OD, vertiges depuis 3 semaines");
  await page.getByTestId("reformulate-motif").click();
  await expect(page.getByTestId("ai-badge").first()).toBeVisible();
  await expect(page.locator("#autreText")).not.toHaveValue("bouchon cerumen OD, vertiges depuis 3 semaines");
  await expect(page.getByTestId("pdf-preview")).toBeVisible();

  await validateDocument(page);
  await expect(page.getByText("Document validé")).toBeVisible();

  await page.getByTestId("prepare-send").click();
  await page.waitForURL(/\/envoi$/);
  await expect(page.getByTestId("channel-EMAIL")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("send").click();
  await expect(page.getByText("Envoi effectué")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "suivi" }).first().click();
  await page.waitForURL(/\/envois\/[^/]+$/);
  const mail = page.frameLocator("iframe[title=\"Aperçu de l'e-mail simulé\"]");
  const href = await mail.getByRole("link", { name: "Consulter le document" }).getAttribute("href");
  expect(href).toMatch(/\/l\/[\w-]+$/);
  const linkPath = new URL(href!).pathname;

  // Côté médecin : lien sécurisé, second facteur = date de naissance du patient.
  const doctor = await context.browser()!.newContext({ viewport: { width: 400, height: 800 } });
  const p2 = await doctor.newPage();
  await p2.goto(linkPath);
  await expect(p2.getByText("MARTIN")).toHaveCount(0);
  await p2.locator("#valeur").fill("01/01/1950");
  await p2.getByRole("button", { name: "Accéder au document" }).click();
  await expect(p2.getByRole("alert").first()).toContainText(/incorrect|essai/i);
  await p2.locator("#valeur").fill("02/11/1941");
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
});
