import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { createDocument } from "./documents";
import { createPatient } from "./patients";
import { runPurge } from "./purge";

setupTestDb();

describe("purge", () => {
  it("supprime documents et patients au-delà de la durée de conservation, et rien d'autre", async () => {
    const { org, centres } = await createTestOrg();
    const ctx = await createTestContext(org, centres);
    const oldPatient = (await createPatient(ctx, { civility: "M.", lastName: "Ancien", firstName: "Paul", birthDate: "" })).created!;
    const recentPatient = (await createPatient(ctx, { civility: "Mme", lastName: "Recente", firstName: "Anne", birthDate: "" })).created!;
    const oldDoc = await createDocument(ctx, "ADRESSAGE", { patientId: oldPatient.id });
    const recentDoc = await createDocument(ctx, "ADRESSAGE", { patientId: recentPatient.id });
    const longAgo = new Date(Date.now() - 6 * 365 * 86_400_000);
    await collections().documents().updateOne({ _id: oldDoc._id }, { $set: { updatedAt: longAgo } });
    await collections().patients().updateOne({ _id: oldPatient.id }, { $set: { updatedAt: longAgo } });
    await collections().auditLogs().updateMany({ organizationId: org._id }, { $set: { at: longAgo } });

    const preview = await runPurge({ organizationId: org._id, dryRun: true });
    expect(preview.documents).toBe(1);
    expect(await collections().documents().countDocuments({ organizationId: org._id })).toBe(2);

    const report = await runPurge({ organizationId: org._id });
    expect(report).toMatchObject({ documents: 1, patients: 1 });
    expect(report.auditLogs).toBeGreaterThan(0);
    expect(await collections().documents().findOne({ _id: oldDoc._id })).toBeNull();
    expect(await collections().documents().findOne({ _id: recentDoc._id })).not.toBeNull();
    expect(await collections().patients().findOne({ _id: recentPatient.id })).not.toBeNull();
  });
});
