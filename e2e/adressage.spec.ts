import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, pickFromCombobox, validateDocument } from "./helpers";

test("adressage : saisie, motif reformulé par l'IA, validation, impression et téléchargement du PDF — jamais d'envoi", async ({ page }) => {
  await login(page, ACCOUNTS.audio);

  await page.getByTestId("new-adressage").click();
  await page.waitForURL(/\/documents\/[^/]+$/);
  const documentPath = new URL(page.url()).pathname;
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
  await expect(page.getByText(/imprimez-le ou téléchargez le PDF/)).toBeVisible();
  // Le PDF validé est affiché, avec les deux actions et sans aucune action d'envoi.
  await expect(page.getByTestId("pdf-preview").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("prepare-send")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Préparer l'envoi/ })).toHaveCount(0);

  // Télécharger le PDF.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-pdf").click()]);
  expect(download.suggestedFilename()).toBe("courrier-adressage-v1.pdf");
  expect(readFileSync(await download.path()).subarray(0, 5).toString()).toBe("%PDF-");

  // Imprimer : le PDF exact est chargé dans un cadre de même origine dont on ouvre la boîte d'impression.
  const pdfResponse = page.waitForResponse((r) => r.url().endsWith(`/api${documentPath}/pdf`) && r.request().method() === "GET");
  await page.getByTestId("print-pdf").click();
  const res = await pdfResponse;
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  await expect(page.locator("iframe[data-testid='print-frame']")).toHaveAttribute("src", /^blob:/);

  // La page d'envoi est refusée : retour au document.
  await page.goto(`${documentPath}/envoi`);
  await page.waitForURL((url) => url.pathname === documentPath);
  await expect(page.getByTestId("send")).toHaveCount(0);

  // Liste filtrée sur l'adressage : ni « Envoyés » ni « Erreurs », aucune case d'envoi groupé.
  await page.goto("/documents?type=ADRESSAGE");
  const statuses = page.getByRole("radiogroup", { name: "Filtrer par statut" });
  await expect(statuses.getByRole("radio", { name: /^Validés/ })).toBeVisible();
  await expect(statuses.getByRole("radio", { name: /^Envoyés/ })).toHaveCount(0);
  await expect(statuses.getByRole("radio", { name: /^Erreurs/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Sélectionner/ })).toHaveCount(0);
});
