/**
 * npm run pingen:check — dépose chaque gabarit postal (données fictives) dans l'environnement
 * STAGING de Pingen, attend sa validation (zones, polices, format) puis annule la lettre.
 * Aucun envoi : la lettre est créée sans envoi automatique et n'est jamais confirmée.
 * Refuse de s'exécuter sans identifiants ou contre l'environnement de production.
 */
import { loadEnv } from "./lib/load-env";
loadEnv();

async function main() {
  const { env, pingenEnvironment, serviceModes } = await import("@/lib/env");
  if (serviceModes().postal !== "live") {
    console.log("Identifiants Pingen absents (PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET, PINGEN_ORGANISATION_ID) : contrôle staging ignoré.");
    return;
  }
  if (pingenEnvironment() !== "staging" || env().PINGEN_ENV === "production") {
    console.error("Ce contrôle ne s'exécute qu'en staging (PINGEN_ENV=staging) : aucune lettre ne doit partir en production.");
    process.exit(1);
  }
  const { pdfFixtures } = await import("@/lib/pdf/fixtures");
  const { renderPdf } = await import("@/lib/pdf/render");
  const { variantsFor } = await import("@/lib/pdf/model");
  const { postalProvider } = await import("@/server/services/postal");
  const provider = postalProvider();
  const options = { deliveryProduct: "cheap" as const, printMode: "simplex" as const, printSpectrum: "color" as const, addressPosition: "right" as const };
  let failures = 0;
  for (const { name, model } of await pdfFixtures()) {
    // Seul le compte rendu part par courrier.
    if (!model.prescriber || !variantsFor(model.type).includes("postal")) continue;
    const { buffer } = await renderPdf(model, "postal");
    let state = await provider.createLetter({
      pdf: buffer,
      fileName: `controle-${name}.pdf`,
      options,
      idempotencyKey: `pingen-check:${name}:${Date.now()}`,
      recipientCity: model.prescriber.address.city,
      recipientPostalCode: model.prescriber.address.postalCode,
    });
    for (let i = 0; i < 20 && state.status === "queued"; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      state = await provider.getLetter(state.externalId);
    }
    const ok = state.status === "awaiting_confirmation";
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${name} — statut Pingen « ${state.rawStatus} »${state.issue ? ` : ${state.issue}` : ""}`);
    await provider.cancelLetter(state.externalId).catch(() => undefined);
  }
  if (failures) {
    console.error(`${failures} gabarit(s) refusé(s) par la validation Pingen.`);
    process.exit(1);
  }
  console.log("Tous les gabarits postaux sont acceptés par Pingen (staging).");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
