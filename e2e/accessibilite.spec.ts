import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).exclude("iframe").analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.length} élément(s) — ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

test.describe("Accessibilité (WCAG 2.2 AA + bonnes pratiques, axe-core)", () => {
  test("écrans publics (connexion, lien sécurisé)", async ({ page }) => {
    await page.goto("/connexion");
    await expectNoViolations(page, "/connexion");
    await page.goto("/l/jeton-inexistant-000000000000000000000000000000");
    await expectNoViolations(page, "/l/[jeton]");
  });

  test("pages principales (audioprothésiste)", async ({ page }) => {
    await login(page, ACCOUNTS.audio);
    for (const url of ["/", "/documents", "/prescripteurs", "/patients", "/envois", "/compte"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await expectNoViolations(page, url);
    }
  });

  test("éditeur de document", async ({ page }) => {
    await login(page, ACCOUNTS.audio);
    await page.getByTestId("new-compte_rendu").click();
    await page.waitForURL(/\/documents\/[^/]+$/);
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "éditeur");
  });

  test("pages d'administration", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    for (const url of ["/admin", "/admin/statistiques", "/admin/utilisateurs", "/admin/audit", "/admin/marque"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await expectNoViolations(page, url);
    }
  });

  test("mode sombre", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await login(page, ACCOUNTS.audio);
    for (const url of ["/", "/documents", "/envois"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await expectNoViolations(page, `${url} (sombre)`);
    }
  });
});

test.describe("Navigation au clavier", () => {
  test("lien d'évitement, palette et création d'un adressage sans souris", async ({ page }) => {
    await login(page, ACCOUNTS.audio);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenu$/);

    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // Raccourci « a » : nouvel adressage.
    await page.locator("body").click({ position: { x: 5, y: 600 } });
    await page.keyboard.press("a");
    await page.waitForURL(/\/documents\/[^/]+$/);
    await expect(page.getByTestId("patient-combobox")).toBeVisible();
  });
});
