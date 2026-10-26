import type { CompteRenduData } from "@/lib/schemas/document";

/*
 * Signature des faits utilisés pour rédiger le commentaire : si le formulaire change
 * après la rédaction (modèle, port quotidien…), le commentaire est signalé comme à
 * mettre à jour. Conservée sur l'appareil pour survivre à un rechargement.
 */

const FACT_KEYS = [
  "degree",
  "ears",
  "deviceType",
  "deviceBrand",
  "deviceBrandOther",
  "deviceModel",
  "deviceClass",
  "rechargeable",
  "customEarmolds",
  "wearDuration",
  "wearHoursPerDay",
  "motivation",
  "handling",
  "attachmentId",
] as const satisfies readonly (keyof CompteRenduData)[];

export function commentFactsSignature(d: CompteRenduData): string {
  return JSON.stringify(
    FACT_KEYS.map((k) => {
      const v = d[k];
      return typeof v === "string" ? v.trim() : v;
    }),
  );
}

const storageKey = (documentId: string) => `lorl:comment-facts:${documentId}`;

export function readCommentFacts(documentId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(documentId));
  } catch {
    return null;
  }
}

export function writeCommentFacts(documentId: string, signature: string) {
  try {
    window.localStorage.setItem(storageKey(documentId), signature);
  } catch {
    // Stockage indisponible (navigation privée) : l'indicateur reste simplement inactif.
  }
}

/** Le commentaire suggéré par l'IA a été rédigé avec d'autres valeurs que celles du formulaire. */
export function isCommentStale(d: CompteRenduData, aiFields: readonly string[], recorded: string | null): boolean {
  if (!recorded || !aiFields.includes("comments") || !d.comments.trim()) return false;
  return recorded !== commentFactsSignature(d);
}
