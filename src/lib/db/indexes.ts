import "server-only";
import { db } from "./client";
import { COLLECTIONS } from "./collections";

let ensured: Promise<void> | null = null;

/** Crée les index (idempotent). Appelé au démarrage paresseusement et par le seed. */
export function ensureIndexes(): Promise<void> {
  if (!ensured) {
    ensured = createIndexes().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

async function createIndexes() {
  const d = db();
  await Promise.all([
    d.collection(COLLECTIONS.centres).createIndex({ organizationId: 1, name: 1 }),
    d.collection(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true }),
    d.collection(COLLECTIONS.users).createIndex({ organizationId: 1, centreIds: 1 }),
    d.collection(COLLECTIONS.prescribers).createIndex({ organizationId: 1, archived: 1, lastName: 1 }),
    d.collection(COLLECTIONS.prescribers).createIndex({ organizationId: 1, centreIds: 1 }),
    d.collection(COLLECTIONS.prescribers).createIndex({ organizationId: 1, favoriteOf: 1 }),
    d.collection(COLLECTIONS.prescribers).createIndex(
      { lastName: "text", firstName: "text", practiceName: "text", "address.city": "text", searchText: "text" },
      { name: "prescribers_text", default_language: "french" },
    ),
    d.collection(COLLECTIONS.patients).createIndex({ organizationId: 1, centreId: 1, lastName: 1 }),
    d.collection(COLLECTIONS.patients).createIndex(
      { lastName: "text", firstName: "text", searchText: "text" },
      { name: "patients_text", default_language: "french" },
    ),
    d.collection(COLLECTIONS.documents).createIndex({ organizationId: 1, centreId: 1, status: 1, updatedAt: -1 }),
    d.collection(COLLECTIONS.documents).createIndex({ organizationId: 1, authorId: 1, updatedAt: -1 }),
    d.collection(COLLECTIONS.documents).createIndex({ organizationId: 1, patientId: 1 }),
    d.collection(COLLECTIONS.documents).createIndex({ organizationId: 1, prescriberId: 1 }),
    // Statistiques (période) et purge (dernière modification).
    d.collection(COLLECTIONS.documents).createIndex({ organizationId: 1, createdAt: -1 }),
    d.collection(COLLECTIONS.documents).createIndex({ organizationId: 1, updatedAt: 1 }),
    d.collection(COLLECTIONS.attachments).createIndex({ organizationId: 1, documentId: 1 }),
    d.collection(COLLECTIONS.dispatches).createIndex({ idempotencyKey: 1 }, { unique: true }),
    d.collection(COLLECTIONS.dispatches).createIndex({ organizationId: 1, centreId: 1, createdAt: -1 }),
    d.collection(COLLECTIONS.dispatches).createIndex({ organizationId: 1, documentId: 1 }),
    d.collection(COLLECTIONS.dispatches).createIndex({ organizationId: 1, patientId: 1, createdAt: -1 }),
    d.collection(COLLECTIONS.dispatches).createIndex({ organizationId: 1, prescriberId: 1, createdAt: -1 }),
    d.collection(COLLECTIONS.dispatches).createIndex({ organizationId: 1, createdAt: -1 }),
    d.collection(COLLECTIONS.dispatches).createIndex({ provider: 1, externalId: 1 }),
    d.collection(COLLECTIONS.dispatches).createIndex({ status: 1, updatedAt: 1 }),
    d.collection(COLLECTIONS.auditLogs).createIndex({ organizationId: 1, at: -1 }),
    d.collection(COLLECTIONS.auditLogs).createIndex({ organizationId: 1, entityType: 1, entityId: 1 }),
    d.collection(COLLECTIONS.auditLogs).createIndex({ organizationId: 1, userId: 1, at: -1 }),
    d.collection(COLLECTIONS.aiUsage).createIndex({ organizationId: 1, centreId: 1, at: -1 }),
    d.collection(COLLECTIONS.aiUsage).createIndex({ organizationId: 1, at: -1 }),
    d.collection(COLLECTIONS.secureLinks).createIndex({ expiresAt: 1 }),
    d.collection(COLLECTIONS.secureLinks).createIndex({ dispatchId: 1 }),
    d.collection(COLLECTIONS.outbox).createIndex({ createdAt: -1 }),
    d.collection(COLLECTIONS.rateLimits).createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
