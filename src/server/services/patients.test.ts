import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { createPatient, deletePatient, getPatient, listPatients, updatePatient } from "./patients";
import { createDocument } from "./documents";

setupTestDb();

describe("patients", () => {
  it("crée un patient dans le centre actif et détecte les doublons", async () => {
    const { org, centres } = await createTestOrg();
    const ctx = await createTestContext(org, centres);
    const res = await createPatient(ctx, { civility: "Mme", lastName: "Durand", firstName: "Jeanne", birthDate: "1946-03-12" });
    expect(res.created?.centreId).toBe(ctx.activeCentre._id);
    const dup = await createPatient(ctx, { civility: "Mme", lastName: "DURAND", firstName: "jeanne", birthDate: "1946-03-12" });
    expect(dup.created).toBeNull();
    expect(dup.similar).toHaveLength(1);
    const other = await createPatient(ctx, { civility: "Mme", lastName: "Durand", firstName: "Jeanne", birthDate: "1950-01-01" });
    expect(other.created).not.toBeNull();
  });

  it("cloisonne les patients par centre", async () => {
    const { org, centres } = await createTestOrg({ centres: 2 });
    const c1 = await createTestContext(org, centres, { centreIds: [centres[0]!._id] });
    const c2 = await createTestContext(org, centres, { centreIds: [centres[1]!._id] });
    const p = (await createPatient(c1, { civility: "M.", lastName: "Martin", firstName: "Robert", birthDate: "" })).created!;
    await expect(getPatient(c2, p.id)).rejects.toThrow();
    await expect(updatePatient(c2, p.id, { civility: "M.", lastName: "X", firstName: "Y", birthDate: "" })).rejects.toThrow();
    expect((await listPatients(c2, { q: "martin" })).total).toBe(0);
    expect((await listPatients(c1, { q: "rob mar" })).total).toBe(1);
    expect((await listPatients(c1, { q: "12/03" })).total).toBe(0);
  });

  it("supprime en cascade (admin uniquement)", async () => {
    const { org, centres } = await createTestOrg();
    const audio = await createTestContext(org, centres);
    const admin = await createTestContext(org, centres, { role: "admin" });
    const p = (await createPatient(audio, { civility: "M.", lastName: "Simon", firstName: "Bernard", birthDate: "1947-04-14" })).created!;
    await createDocument(audio, "COMPTE_RENDU", { patientId: p.id });
    await expect(deletePatient(audio, p.id)).rejects.toThrow();
    const res = await deletePatient(admin, p.id);
    expect(res.documents).toBe(1);
    expect(await collections().patients().findOne({ _id: p.id })).toBeNull();
    expect(await collections().documents().countDocuments({ patientId: p.id })).toBe(0);
  });
});
