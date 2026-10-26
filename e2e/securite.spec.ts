import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, pickFromCombobox } from "./helpers";

test.describe("Sécurité", () => {
  test("en-têtes de sécurité présents", async ({ request }) => {
    const res = await request.get("/connexion");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    // Scripts : nonce par requête + strict-dynamic, jamais 'unsafe-inline'.
    const scriptSrc = /script-src([^;]*)/.exec(h["content-security-policy"] ?? "")?.[1] ?? "";
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    const again = (await request.get("/connexion")).headers()["content-security-policy"];
    expect(again).not.toBe(h["content-security-policy"]);
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["permissions-policy"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("un lien sécurisé inconnu ne révèle rien et n'est pas indexable", async ({ request }) => {
    const res = await request.get("/l/jeton-inexistant");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(res.headers()["cache-control"]).toContain("no-store");
    const pdf = await request.get("/l/jeton-inexistant/pdf");
    expect(pdf.status()).toBeGreaterThanOrEqual(400);
  });

  test("les tâches planifiées exigent le secret", async ({ request }) => {
    expect((await request.get("/api/cron/statuts")).status()).toBe(401);
    expect((await request.get("/api/cron/purge")).status()).toBe(401);
    const ok = await request.get("/api/cron/statuts", { headers: { authorization: "Bearer e2e-cron-secret" } });
    expect(ok.status()).toBe(200);
  });

  test("les webhooks refusent les requêtes non signées", async ({ request }) => {
    const resend = await request.post("/api/webhooks/resend", { data: { type: "email.delivered", data: {} } });
    expect(resend.status()).toBeGreaterThanOrEqual(400);
    const pingen = await request.post("/api/webhooks/pingen", { data: { data: {} } });
    expect(pingen.status()).toBeGreaterThanOrEqual(400);
  });
});

test("aucune violation de CSP ni erreur JavaScript sur les écrans clés", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => problems.push(e.message));
  await login(page, ACCOUNTS.audio);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("new-compte_rendu").click();
  await page.waitForURL(/\/documents\/[^/]+$/);
  await pickFromCombobox(page, "patient-combobox", "durand", /Jeanne DURAND/);
  await expect(page.getByTestId("pdf-preview")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.goto("/envois");
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
});
