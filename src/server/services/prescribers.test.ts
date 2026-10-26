import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import {
  createPrescriber,
  importPrescribers,
  listDuplicateGroups,
  listPrescribers,
  mergePrescribers,
  suggestPrescribers,
  toggleFavorite,
} from "./prescribers";
import { createDocument } from "./documents";

setupTestDb();

const base = {
  civility: "Dr",
  lastName: "Lefèvre",
  firstName: "Antoine",
  specialty: "ORL",
  practiceName: "Cabinet du Test",
  address: { line1: "1 rue A", line2: "", postalCode: "93200", city: "Saint-Denis", country: "FRANCE" },
  email: "a.lefevre@test.test",
};

describe("annuaire des prescripteurs", () => {
  it("crée une fiche puis signale un doublon probable", async () => {
    const { org, centres } = await createTestOrg();
    const ctx = await createTestContext(org, centres);
    const first = await createPrescriber(ctx, base);
    expect(first.created?.lastName).toBe("Lefèvre");
    expect(first.created?.centreIds).toEqual([ctx.activeCentre._id]);
    const dup = await createPrescriber(ctx, { ...base, email: "" });
    expect(dup.created).toBeNull();
    expect(dup.similar).toHaveLength(1);
    const forced = await createPrescriber(ctx, { ...base, email: "" }, { force: true });
    expect(forced.created).not.toBeNull();
  });

  it("recherche sans accents et met les favoris en tête des suggestions", async () => {
    const { org, centres } = await createTestOrg();
    const ctx = await createTestContext(org, centres);
    const a = (await createPrescriber(ctx, { ...base, lastName: "Zola", email: "z@t.test" })).created!;
    await createPrescriber(ctx, { ...base, lastName: "Arnaud", email: "ar@t.test" });
    const found = await listPrescribers(ctx, { q: "zol" });
    expect(found.items.map((p) => p.lastName)).toEqual(["Zola"]);
    expect((await listPrescribers(ctx, { q: "saint-denis" })).total).toBe(2);
    await toggleFavorite(ctx, a.id);
    const suggestions = await suggestPrescribers(ctx, "");
    expect(suggestions[0]!.id).toBe(a.id);
    expect(suggestions[0]!.isFavorite).toBe(true);
    expect((await listPrescribers(ctx, { filter: "favorites" })).total).toBe(1);
  });

  it("refuse l'import aux non-administrateurs et dédoublonne à l'import", async () => {
    const { org, centres } = await createTestOrg();
    const audio = await createTestContext(org, centres);
    const admin = await createTestContext(org, centres, { role: "admin" });
    await expect(importPrescribers(audio, [], { updateExisting: false })).rejects.toThrow();
    await createPrescriber(admin, { ...base, phone: "" });
    const report = await importPrescribers(
      admin,
      [
        { row: 2, value: { ...base, civility: "Dr", rpps: "", phone: "01 99 00 00 01", preferredChannel: "email", salutation: "", notes: "", centreIds: [], firstName: "Antoine", specialty: "ORL", practiceName: "", email: "a.lefevre@test.test", address: base.address } },
        { row: 3, value: { ...base, civility: "Dr", rpps: "", phone: "", preferredChannel: "courrier", salutation: "", notes: "", centreIds: [], firstName: "Marie", lastName: "Nouvelle", specialty: "ORL", practiceName: "", email: "m.n@test.test", address: base.address } },
      ],
      { updateExisting: true },
    );
    expect(report).toMatchObject({ created: 1, updated: 1, skipped: 0 });
    const updated = await collections().prescribers().findOne({ organizationId: org._id, lastName: "Lefèvre" });
    expect(updated?.phone).toBe("01 99 00 00 01");
  });

  it("fusionne des doublons et rattache les documents à la fiche principale", async () => {
    const { org, centres } = await createTestOrg();
    const admin = await createTestContext(org, centres, { role: "admin" });
    const master = (await createPrescriber(admin, { ...base, phone: "" })).created!;
    const other = (await createPrescriber(admin, { ...base, email: "", phone: "01 99 00 00 09" }, { force: true })).created!;
    const doc = await createDocument(admin, "ADRESSAGE", { prescriberId: other.id });
    const groups = await listDuplicateGroups(admin);
    expect(groups).toHaveLength(1);
    await mergePrescribers(admin, master.id, [other.id]);
    const merged = await collections().prescribers().findOne({ _id: master.id });
    expect(merged?.phone).toBe("01 99 00 00 09");
    expect((await collections().prescribers().findOne({ _id: other.id }))?.archived).toBe(true);
    expect((await collections().documents().findOne({ _id: doc._id }))?.prescriberId).toBe(master.id);
    const logs = await collections().auditLogs().find({ action: "prescriber.merge" }).toArray();
    expect(logs).toHaveLength(1);
  });
});
