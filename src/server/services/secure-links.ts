import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/env";
import { collections } from "@/lib/db/collections";
import type { SecureLinkDoc } from "@/lib/db/types";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function factorHash(linkId: string, value: string): string {
  return createHmac("sha256", `${authSecret()}:lien`).update(`${linkId}:${value}`).digest("hex");
}

/** Normalise une date de naissance saisie (JJ/MM/AAAA, JJMMAAAA, AAAA-MM-JJ…) en AAAA-MM-JJ. */
export function normalizeBirthDate(input: string): string | null {
  const v = input.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\D?(\d{1,2})\D?(\d{4})$/.exec(v.replace(/\s/g, "")) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(v.replace(/\D/g, ""));
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

export async function createSecureLink(input: {
  organizationId: string;
  dispatchId: string;
  documentId: string;
  pdfKey: string;
  secondFactor: "birthdate" | "code";
  birthDate: string;
  validityDays: number;
}): Promise<{ token: string; code: string | null; link: SecureLinkDoc }> {
  const token = randomBytes(32).toString("base64url");
  const id = hashToken(token);
  const code = input.secondFactor === "code" ? String(randomInt(0, 1_000_000)).padStart(6, "0") : null;
  const factor = input.secondFactor === "code" ? code! : input.birthDate;
  const link: SecureLinkDoc = {
    _id: id,
    organizationId: input.organizationId,
    dispatchId: input.dispatchId,
    documentId: input.documentId,
    pdfKey: input.pdfKey,
    secondFactor: input.secondFactor,
    factorHash: factorHash(id, factor),
    expiresAt: new Date(Date.now() + input.validityDays * 86_400_000),
    attempts: 0,
    lockedUntil: null,
    accessLog: [],
    revoked: false,
    createdAt: new Date(),
  };
  await collections().secureLinks().insertOne(link);
  return { token, code, link };
}

export async function findLink(token: string): Promise<SecureLinkDoc | null> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  return collections().secureLinks().findOne({ _id: hashToken(token) });
}

export type LinkCheck = { ok: true; link: SecureLinkDoc } | { ok: false; reason: "invalid" | "expired" | "locked" | "wrong"; remaining?: number };

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;
/** Au-delà de ce nombre d'échecs cumulés, le lien est révoqué (un nouvel envoi sera nécessaire). */
export const MAX_TOTAL_FAILURES = 20;

/**
 * Vérifie le second facteur ; 5 essais puis verrouillage de 15 minutes, révocation après
 * 20 échecs cumulés. Chaque essai est réservé atomiquement avant la comparaison : des
 * requêtes parallèles ne peuvent pas dépasser le quota.
 */
export async function verifySecondFactor(token: string, value: string): Promise<LinkCheck> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return { ok: false, reason: "invalid" };
  const id = hashToken(token);
  const now = new Date();
  const link = await collections()
    .secureLinks()
    .findOneAndUpdate(
      { _id: id, revoked: false, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
  if (!link) {
    const current = await collections().secureLinks().findOne({ _id: id });
    if (!current || current.revoked) return { ok: false, reason: "invalid" };
    if (current.expiresAt <= now) return { ok: false, reason: "expired" };
    return { ok: false, reason: "locked" };
  }
  const normalized = link.secondFactor === "birthdate" ? normalizeBirthDate(value) : value.replace(/\D/g, "");
  const expected = Buffer.from(link.factorHash);
  const given = Buffer.from(factorHash(link._id, normalized ?? "§"));
  const match = expected.length === given.length && timingSafeEqual(expected, given);
  if (match) {
    await collections().secureLinks().updateOne({ _id: link._id }, { $set: { attempts: 0, lockedUntil: null } });
    return { ok: true, link };
  }
  const failures = (link.failures ?? 0) + 1;
  if (failures >= MAX_TOTAL_FAILURES) {
    await collections().secureLinks().updateOne({ _id: link._id }, { $set: { revoked: true }, $inc: { failures: 1 } });
    return { ok: false, reason: "invalid" };
  }
  if (link.attempts >= MAX_ATTEMPTS) {
    await collections()
      .secureLinks()
      .updateOne({ _id: link._id }, { $set: { attempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }, $inc: { failures: 1 } });
    return { ok: false, reason: "locked" };
  }
  await collections().secureLinks().updateOne({ _id: link._id }, { $inc: { failures: 1 } });
  return { ok: false, reason: "wrong", remaining: MAX_ATTEMPTS - link.attempts };
}

/** Jeton de session court (15 min) prouvant la réussite du second facteur pour ce lien. */
export function signAccess(linkId: string, exp: number): string {
  return createHmac("sha256", `${authSecret()}:acces`).update(`${linkId}:${exp}`).digest("base64url");
}

export function verifyAccess(linkId: string, value: string | undefined): boolean {
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(signAccess(linkId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
