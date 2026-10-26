import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Demo-Liaison-2026!";
export const BILANS_DIR = path.resolve("demo/bilans");

export const ACCOUNTS = {
  admin: "direction@demo.test",
  audio: "claire.morel@demo.test",
  assistant: "lea.petit@demo.test",
} as const;

/** Connexion par e-mail + mot de passe ; pour l'administratrice, saisit le code TOTP affiché en mode démo. */
export async function login(page: Page, email: string) {
  await page.goto("/connexion");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/connexion/verification");
  if (new URL(page.url()).pathname === "/connexion/verification") {
    const hint = await page.getByText("Mode démo : code actuel").textContent();
    const code = /(\d{6})/.exec(hint ?? "")?.[1];
    expect(code, "code TOTP de démonstration affiché").toBeTruthy();
    await page.locator("#code").fill(code!);
    await page.getByRole("button", { name: "Vérifier" }).click();
    await page.waitForURL((url) => url.pathname === "/");
  }
}

/** Sélectionne une option dans un combobox de recherche (patient / prescripteur). */
export async function pickFromCombobox(page: Page, testId: string, query: string, option: RegExp) {
  await page.getByTestId(testId).click();
  await page.keyboard.type(query);
  await page.getByRole("option", { name: option }).click();
}

/** Valide le document en acceptant la relecture des champs suggérés par l'IA si demandé. */
export async function validateDocument(page: Page) {
  await page.getByTestId("validate").click();
  const confirm = page.getByRole("button", { name: "J'ai relu, valider" });
  await Promise.race([
    confirm.waitFor({ state: "visible" }).then(() => confirm.click()),
    page.getByTestId("prepare-send").waitFor({ state: "visible" }),
  ]);
  await expect(page.getByTestId("prepare-send")).toBeVisible();
}

/** Sélectionne une option d'un groupe de choix (sans la désélectionner si elle est déjà active, ex. valeur mémorisée). */
export async function choose(page: Page, name: string, exact = false) {
  const radio = page.getByRole("radio", { name, exact });
  if ((await radio.getAttribute("aria-checked")) !== "true") await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
}
