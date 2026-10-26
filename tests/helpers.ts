import { randomUUID } from "node:crypto";
import { afterAll, beforeAll } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { closeDb, db } from "@/lib/db/client";
import { collections } from "@/lib/db/collections";
import { ensureIndexes } from "@/lib/db/indexes";
import type { UserContext, SessionUser } from "@/lib/auth/session";
import type { CentreDoc, OrganizationDoc } from "@/lib/db/types";
import { DEFAULT_COLORS, DEFAULT_FONTS, defaultSettings } from "@/lib/brand";
import type { Role } from "@/lib/schemas/common";

/** Base de test isolée par fichier. */
export function setupTestDb() {
  beforeAll(async () => {
    process.env.MONGODB_DB = `t_${randomUUID().slice(0, 8)}`;
    resetEnvCache();
    await ensureIndexesFresh();
  });
  afterAll(async () => {
    await db().dropDatabase();
    await closeDb();
  });
}

async function ensureIndexesFresh() {
  await ensureIndexes();
}

export async function createTestOrg(opts: { centres?: number } = {}) {
  const now = new Date();
  const org: OrganizationDoc = {
    _id: randomUUID(),
    name: "Org test",
    brand: { name: "Marque Test", slogan: "SLOGAN TEST", logo: null, colors: { ...DEFAULT_COLORS }, fonts: { ...DEFAULT_FONTS } },
    legal: { companyName: "", mentions: "" },
    settings: defaultSettings(),
    demo: true,
    createdAt: now,
    updatedAt: now,
  };
  await collections().organizations().insertOne(org);
  const centres: CentreDoc[] = Array.from({ length: opts.centres ?? 2 }, (_, i) => ({
    _id: randomUUID(),
    organizationId: org._id,
    name: `Centre ${i + 1}`,
    address: { line1: `${i + 1} rue du Test`, line2: "", postalCode: "75001", city: "Paris", country: "FRANCE" },
    phone: "01 99 00 00 0" + i,
    email: `centre${i + 1}@test.test`,
    defaultSignature: "",
    senderAddress: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
  await collections().centres().insertMany(centres);
  return { org, centres };
}

export async function createTestContext(
  org: OrganizationDoc,
  centres: CentreDoc[],
  opts: { role?: Role; centreIds?: string[]; canSend?: boolean } = {},
): Promise<UserContext> {
  const id = randomUUID();
  const role = opts.role ?? "audioprothesiste";
  const centreIds = opts.centreIds ?? centres.map((c) => c._id);
  const now = new Date();
  await collections().users().insertOne({
    _id: id,
    email: `${id.slice(0, 8)}@test.test`,
    name: "Test User",
    emailVerified: true,
    role,
    organizationId: org._id,
    centreIds,
    firstName: "Camille",
    lastName: "Testeur",
    title: "Audioprothésiste D.E",
    active: true,
    canSend: opts.canSend ?? false,
    twoFactorEnabled: role === "admin",
    preferences: { activeCentreId: centreIds[0] ?? null, learned: {}, favoritesFirst: true },
    createdAt: now,
    updatedAt: now,
  });
  const user: SessionUser = {
    id,
    email: `${id.slice(0, 8)}@test.test`,
    firstName: "Camille",
    lastName: "Testeur",
    fullName: "Camille Testeur",
    title: "Audioprothésiste D.E",
    role,
    organizationId: org._id,
    centreIds,
    canSend: opts.canSend ?? false,
    twoFactorEnabled: role === "admin",
    hasSignature: false,
  };
  const accessible = role === "admin" ? centres : centres.filter((c) => centreIds.includes(c._id));
  return { user, organization: org, centres: accessible, activeCentre: accessible[0]! };
}
