import "server-only";
import { db } from "@/lib/db/client";
import { env, pingenEnvironment, serviceModes } from "@/lib/env";
import { aiProvider } from "@/ai";
import { emailProvider } from "./email";
import { senderAddress } from "./email/from";
import { postalProvider } from "./postal";
import { storage } from "./storage";

export interface ServiceState {
  key: "database" | "ai" | "email" | "postal" | "storage";
  label: string;
  mode: "live" | "mock";
  status: "ok" | "demo" | "error";
  detail: string;
}

async function check(fn: () => Promise<void>): Promise<string | null> {
  try {
    await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), 8000))]);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "erreur inconnue";
  }
}

/** État des services externes (connecté / mode démo / erreur), avec test de connexion facultatif. */
export async function serviceStatus(opts: { test: boolean }): Promise<ServiceState[]> {
  const m = serviceModes();
  const e = env();
  const dbErr = await check(async () => void (await db().command({ ping: 1 })));
  const states: ServiceState[] = [
    { key: "database", label: "Base de données", mode: "live", status: dbErr ? "error" : "ok", detail: dbErr ?? "MongoDB joignable" },
  ];
  const one = async (key: ServiceState["key"], label: string, mode: "live" | "mock", demoDetail: string, liveDetail: string, ping: () => Promise<void>) => {
    if (mode === "mock") return states.push({ key, label, mode, status: "demo", detail: demoDetail });
    const err = opts.test ? await check(ping) : null;
    states.push({ key, label, mode, status: err ? "error" : "ok", detail: err ? `Échec du test : ${err}` : liveDetail });
  };
  const sender = senderAddress();
  await one("ai", "IA (Anthropic)", m.ai, "Réponses simulées (ANTHROPIC_API_KEY absente)", `Vision : ${e.AI_MODEL_VISION} · Rédaction : ${e.AI_MODEL_TEXT}`, () => aiProvider().ping());
  await one("email", "E-mail (Resend)", m.email, "E-mails simulés, visibles dans la boîte d'envoi de démonstration", `Expéditeur technique : ${sender.address}`, () => emailProvider().ping());
  // Expéditeur invalide : signalé sans attendre le test de connexion (chaque envoi échouerait).
  if (m.email === "live" && sender.issue) Object.assign(states[states.length - 1], { status: "error", detail: sender.issue });
  await one("postal", "Courrier (Pingen)", m.postal, "Courriers simulés (aucun envoi réel)", `Environnement : ${pingenEnvironment() === "production" ? "production" : "staging (test, aucun envoi réel)"}`, () => postalProvider().ping());
  await one("storage", "Stockage des fichiers", m.storage, storage().name === "gridfs" ? "Stockage de démonstration dans MongoDB (GridFS)" : "Disque local (développement)", `S3 ${e.S3_BUCKET} (${e.S3_REGION}), chiffrement côté serveur`, () => storage().ping());
  return states;
}
