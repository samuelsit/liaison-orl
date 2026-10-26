/**
 * npm run ai:check — vérifie l'intégration Anthropic sur un bilan FICTIF (demo/bilans) :
 * lecture du bilan (modèle vision), comparaison à la vérité terrain, rédaction d'un commentaire.
 * Consomme quelques milliers de jetons (quelques centimes). Aucune donnée réelle n'est envoyée.
 */
import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env";
loadEnv();

async function main() {
  const { env } = await import("@/lib/env");
  if (!env().ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY absente : l'IA fonctionne en mode démo, rien à vérifier.");
    return;
  }
  const { AnthropicProvider } = await import("@/ai/anthropic");
  const { rawExtractionSchema, toAudiometry } = await import("@/ai/extraction-schema");
  const { readDemoMarker } = await import("@/ai/mock");
  const { buildCommentFacts, factsToText } = await import("@/ai/facts");
  const { emptyCompteRendu } = await import("@/lib/documents/defaults");
  const { estimateCostMicroUsd } = await import("@/ai");
  const provider = new AnthropicProvider(env().ANTHROPIC_API_KEY!);
  const file = process.argv[2] ?? "demo/bilans/bilan-durand-jeanne.pdf";
  const data = readFileSync(file);
  const truth = readDemoMarker(data);
  console.log(`▶ Lecture de ${file} avec ${env().AI_MODEL_VISION}…`);
  const t0 = Date.now();
  const res = await provider.extract({ data, mimeType: file.endsWith(".pdf") ? "application/pdf" : "image/jpeg" });
  const parsed = rawExtractionSchema.safeParse(res.raw);
  if (!parsed.success) throw new Error(`Sortie non conforme : ${parsed.error.message}`);
  const a = toAudiometry(parsed.data);
  console.log(`  ${Date.now() - t0} ms — ${res.usage.inputTokens} jetons en entrée, ${res.usage.outputTokens} en sortie (~${(estimateCostMicroUsd(res.usage.model, res.usage) / 1e6).toFixed(4)} $)`);
  if (truth) {
    const t = toAudiometry(truth);
    let ok = 0;
    let total = 0;
    for (const ear of ["right", "left"] as const) {
      for (const kind of ["air", "bone"] as const) {
        for (const [f, m] of Object.entries(t[ear][kind])) {
          total++;
          if (a[ear][kind][f as keyof typeof a.right.air]?.value === m!.value) ok++;
        }
      }
    }
    console.log(`  Seuils relus correctement : ${ok}/${total}`);
  }
  console.log(`▶ Rédaction d'un commentaire avec ${env().AI_MODEL_TEXT}…`);
  const facts = buildCommentFacts({ ...emptyCompteRendu("2026-10-17"), ears: "deux", deviceType: "ecouteur_deporte", deviceBrand: "signia", rechargeable: true, wearHoursPerDay: 11, wearDuration: "3 semaines", handling: "oui" }, a, { civility: "Mme", birthDate: "1946-03-12" }, "");
  const c = await provider.writeComment({ facts, factsText: factsToText(facts), style: "standard", tone: "confraternel, factuel", minLines: 4, maxLines: 8 });
  console.log(`  ${(c.raw as { comment: string }).comment}`);
  console.log("✔ Intégration Anthropic opérationnelle.");
}

main().catch((err) => {
  console.error("✖", err instanceof Error ? err.message : err);
  process.exit(1);
});
