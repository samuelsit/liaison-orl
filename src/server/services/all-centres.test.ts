import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { parisMonthStart } from "@/lib/dates";
import { reformulateMotif } from "./ai";
import { createDocument } from "./documents";
import { centreOverview } from "./overview";
import { createPatient, listPatients } from "./patients";
import { createPrescriber, listPrescribers, suggestPrescribers } from "./prescribers";

setupTestDb();

async function setup() {
  const { org, centres } = await createTestOrg({ centres: 3 });
  const admin = await createTestContext(org, centres, { role: "admin", allCentres: true });
  return { org, centres, admin };
}

describe("vue « Tous les centres » : création", () => {
  it("rattache le document au centre choisi, refuse un centre hors organisation et exige un choix", async () => {
    const { centres, admin } = await setup();
    expect((await createDocument(admin, "ADRESSAGE", { centreId: centres[2]!._id })).centreId).toBe(centres[2]!._id);
    await expect(createDocument(admin, "ADRESSAGE", { centreId: "centre-inconnu" })).rejects.toThrow(/vos centres/);
    await expect(createDocument(admin, "ADRESSAGE")).rejects.toThrow("Choisissez le centre du document.");
  });

  it("reprend le centre du patient quand il est fourni", async () => {
    const { centres, admin } = await setup();
    const patient = (await createPatient(admin, { civility: "M.", lastName: "Martin", firstName: "Paul", birthDate: "", centreId: centres[1]!._id })).created!;
    const doc = await createDocument(admin, "COMPTE_RENDU", { patientId: patient.id });
    expect(doc.centreId).toBe(centres[1]!._id);
  });

  it("hors vue « Tous les centres », garde le centre actif (comportement inchangé)", async () => {
    const { org, centres } = await setup();
    const audio = await createTestContext(org, centres);
    const patient = (await createPatient(audio, { civility: "Mme", lastName: "Petit", firstName: "Anne", birthDate: "", centreId: centres[1]!._id })).created!;
    const doc = await createDocument(audio, "ADRESSAGE", { patientId: patient.id });
    expect(doc.centreId).toBe(audio.activeCentre._id);
  });

  it("exige le centre d'un nouveau patient et crée les ORL sans centre (fiche commune)", async () => {
    const { centres, admin } = await setup();
    await expect(createPatient(admin, { civility: "M.", lastName: "Sans", firstName: "Centre", birthDate: "" })).rejects.toThrow("Choisissez le centre du patient.");
    const ok = await createPatient(admin, { civility: "M.", lastName: "Avec", firstName: "Centre", birthDate: "", centreId: centres[2]!._id });
    expect(ok.created?.centreId).toBe(centres[2]!._id);
    const orl = await createPrescriber(admin, { lastName: "Commun", firstName: "Jean", address: { line1: "1 rue A", postalCode: "75001", city: "Paris" } });
    expect(orl.created?.centreIds).toEqual([]);
  });
});

describe("vue « Tous les centres » : lectures", () => {
  it("liste les patients de tous les centres et ignore le filtre « centre actif » de l'annuaire", async () => {
    const { centres, admin } = await setup();
    for (const [i, c] of centres.entries()) {
      await createPatient(admin, { civility: "M.", lastName: `Patient${i}`, firstName: "Test", birthDate: "", centreId: c._id });
    }
    expect((await listPatients(admin, { scope: "active" })).total).toBe(3);
    await createPrescriber(admin, { lastName: "Ailleurs", firstName: "Luc", centreIds: [centres[2]!._id], address: { line1: "1 rue A", postalCode: "75001", city: "Paris" } });
    await createPrescriber(admin, { lastName: "Global", firstName: "Eve", address: { line1: "2 rue B", postalCode: "75002", city: "Paris" } });
    expect((await listPrescribers(admin, { filter: "centre" })).total).toBe(2);
    // Sans favori ni récent, les suggestions se complètent par ordre alphabétique.
    expect((await suggestPrescribers(admin, "")).map((p) => p.lastName)).toEqual(["Ailleurs", "Global"]);
  });

  it("calcule la vue d'ensemble par centre (zéros compris)", async () => {
    const { org, centres, admin } = await setup();
    const [a, b, c] = centres.map((x) => x._id) as [string, string, string];
    await createDocument(admin, "ADRESSAGE", { centreId: a });
    await createDocument(admin, "COMPTE_RENDU", { centreId: a });
    const cr = await createDocument(admin, "COMPTE_RENDU", { centreId: b });
    await collections().documents().updateOne({ _id: cr._id }, { $set: { status: "VALIDE" } });
    const old = await createDocument(admin, "ADRESSAGE", { centreId: b });
    await collections().documents().updateOne({ _id: old._id }, { $set: { createdAt: new Date(parisMonthStart().getTime() - 1000) } });
    await collections().dispatches().insertOne({
      _id: "d-err",
      organizationId: org._id,
      centreId: b,
      documentId: cr._id,
      channel: "EMAIL",
      status: "failed",
      acknowledged: false,
    } as never);
    const rows = await centreOverview(org._id, [a, b, c]);
    expect(rows).toEqual([
      { centreId: a, drafts: 2, toSend: 0, errors: 0, month: 2 },
      { centreId: b, drafts: 1, toSend: 1, errors: 1, month: 1 },
      { centreId: c, drafts: 0, toSend: 0, errors: 0, month: 0 },
    ]);
  });

  it("rattache la consommation IA au centre du document, pas au centre actif", async () => {
    const { centres, admin } = await setup();
    const doc = await createDocument(admin, "ADRESSAGE", { centreId: centres[2]!._id });
    await reformulateMotif(admin, doc._id, { notes: "bouchon cérumen OD, vertiges depuis 3 semaines", patientId: null, prescriberId: null });
    const usage = await collections().aiUsage().find({ organizationId: admin.user.organizationId }).toArray();
    expect(usage.map((u) => u.centreId)).toEqual([centres[2]!._id]);
  });
});

describe("premier jour du mois (heure de Paris)", () => {
  it("tient compte de l'heure d'hiver et d'été", () => {
    expect(parisMonthStart(new Date("2026-11-11T10:00:00Z")).toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(parisMonthStart(new Date("2026-07-15T10:00:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
    // 31 octobre 23:30 UTC = 1er novembre 00:30 à Paris.
    expect(parisMonthStart(new Date("2026-10-31T23:30:00Z")).toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });
});
