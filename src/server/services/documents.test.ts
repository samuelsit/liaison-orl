import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { extractBilan } from "./ai";
import { rebuildBilan, saveBilan, uploadBilan } from "./attachments";
import { storage } from "./storage";
import { createDocument, deleteDocument, getDocumentForUser, renderPreview, reopenDocument, saveDraft, validateDocument } from "./documents";
import { createPatient } from "./patients";
import { createPrescriber } from "./prescribers";

setupTestDb();

async function setup() {
  const { org, centres } = await createTestOrg();
  const ctx = await createTestContext(org, centres);
  const patient = (await createPatient(ctx, { civility: "Mme", lastName: "Durand", firstName: "Jeanne", birthDate: "1946-03-12" })).created!;
  const prescriber = (await createPrescriber(ctx, { lastName: "Lefèvre", firstName: "Antoine", email: "a@test.test", address: { line1: "1 rue A", postalCode: "93200", city: "Saint-Denis" } })).created!;
  return { org, centres, ctx, patient, prescriber };
}

describe("cycle de vie d'un document", () => {
  it("crée, enregistre, refuse une validation incomplète puis valide et stocke le PDF", async () => {
    const { ctx, patient, prescriber } = await setup();
    const doc = await createDocument(ctx, "ADRESSAGE");
    expect(doc.status).toBe("BROUILLON");
    const first = await validateDocument(ctx, doc._id);
    expect(first.ok).toBe(false);
    if (!first.ok) expect(Object.keys(first.errors)).toEqual(["patientId", "prescriberId", "exams"]);

    await saveDraft(ctx, doc._id, {
      data: { ...doc.data, exams: { conduits: true, bilan: false, autre: false } },
      patientId: patient.id,
      prescriberId: prescriber.id,
      aiFields: [],
    });
    const res = await validateDocument(ctx, doc._id);
    expect(res.ok).toBe(true);
    const saved = await getDocumentForUser(ctx, doc._id);
    expect(saved.status).toBe("VALIDE");
    expect(saved.version).toBe(1);
    expect(saved.snapshot?.patient.lastName).toBe("Durand");
    const pdf = await storage().get(saved.pdfKey!);
    expect(pdf?.subarray(0, 5).toString()).toBe("%PDF-");
    // Le prescripteur devient le prescripteur habituel du patient.
    expect((await collections().patients().findOne({ _id: patient.id }))?.usualPrescriberId).toBe(prescriber.id);

    await expect(saveDraft(ctx, doc._id, { data: saved.data, patientId: null, prescriberId: null, aiFields: [] })).rejects.toThrow(/rouvrez/);
    await reopenDocument(ctx, doc._id);
    expect((await getDocumentForUser(ctx, doc._id)).status).toBe("BROUILLON");
    await validateDocument(ctx, doc._id);
    expect((await getDocumentForUser(ctx, doc._id)).version).toBe(2);
  });

  it("apprend les valeurs du compte rendu et les propose au suivant", async () => {
    const { ctx, patient, prescriber } = await setup();
    for (let i = 0; i < 2; i++) {
      const doc = await createDocument(ctx, "COMPTE_RENDU");
      await saveDraft(ctx, doc._id, {
        data: { ...doc.data, degree: "moyenne", ears: "deux", deviceType: "contour", deviceBrand: "starkey", deviceClass: "1", rechargeable: true },
        patientId: patient.id,
        prescriberId: prescriber.id,
        aiFields: ["degree"],
      });
      const r = await validateDocument(ctx, doc._id);
      expect(r.ok).toBe(true);
    }
    const next = await createDocument(ctx, "COMPTE_RENDU");
    expect(next.data).toMatchObject({ deviceBrand: "starkey", deviceClass: "1", rechargeable: true, deviceType: "contour", degree: null });
  });

  it("refuse l'accès à un document d'un autre centre et la validation par un assistant", async () => {
    const { org, centres, ctx } = await setup();
    const doc = await createDocument(ctx, "ADRESSAGE");
    const other = await createTestContext(org, centres, { centreIds: [centres[1]!._id] });
    await expect(getDocumentForUser(other, doc._id)).rejects.toThrow();
    const assistant = await createTestContext(org, centres, { role: "assistant" });
    await expect(validateDocument(assistant, doc._id)).rejects.toThrow();
  });

  it("fige le bilan fusionné confirmé dans l'instantané, et l'ignore tant qu'il n'est pas confirmé", async () => {
    const { ctx, patient, prescriber } = await setup();
    const doc = await createDocument(ctx, "COMPTE_RENDU", { patientId: patient.id });
    const att = await uploadBilan(ctx, doc._id, { name: "tonale.pdf", data: readFileSync("demo/bilans/bilan-moreau-andre-tonale.pdf") });
    await extractBilan(ctx, att._id);
    const bilan = await rebuildBilan(ctx, doc._id);
    const data = { ...doc.data, degree: "moyenne", ears: "deux", deviceType: "contour", deviceBrand: "signia", deviceClass: "1" };
    await saveDraft(ctx, doc._id, { data, patientId: patient.id, prescriberId: prescriber.id, aiFields: [] });
    // Non confirmé : l'aperçu n'imprime pas l'audiogramme.
    const before = await renderPreview(ctx, doc._id, { data, patientId: patient.id, prescriberId: prescriber.id });
    await saveBilan(ctx, doc._id, bilan.audiometry, true);
    const after = await renderPreview(ctx, doc._id, { data, patientId: patient.id, prescriberId: prescriber.id });
    expect(after.info.pages).toBeGreaterThan(before.info.pages);
    const v = await validateDocument(ctx, doc._id);
    expect(v.ok).toBe(true);
    const saved = await getDocumentForUser(ctx, doc._id);
    const frozen = saved.snapshot?.audiometry as { right: { air: Record<string, { value: number; source?: string }> } } | null;
    expect(frozen?.right.air["1000"]).toMatchObject({ value: 45, source: att._id });
    expect(saved.bilan?.confirmed).toBe(true);
  });

  it("génère un aperçu PDF et supprime un brouillon", async () => {
    const { ctx, patient } = await setup();
    const doc = await createDocument(ctx, "COMPTE_RENDU", { patientId: patient.id });
    const { buffer, info } = await renderPreview(ctx, doc._id, { data: { ...doc.data, comments: "x ".repeat(900) }, patientId: patient.id, prescriberId: null });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(info.pages).toBeGreaterThanOrEqual(2);
    await deleteDocument(ctx, doc._id);
    expect(await collections().documents().findOne({ _id: doc._id })).toBeNull();
  });
});

describe("droits sur les documents", () => {
  it("une assistante ne peut ni rouvrir ni supprimer un document validé", async () => {
    const { org, centres, ctx, patient, prescriber } = await setup();
    const assistant = await createTestContext(org, centres, { role: "assistant" });
    const doc = await createDocument(ctx, "ADRESSAGE");
    await saveDraft(ctx, doc._id, { data: { ...doc.data, exams: { conduits: true, bilan: false, autre: false } }, patientId: patient.id, prescriberId: prescriber.id, aiFields: [] });
    await validateDocument(ctx, doc._id);
    await expect(reopenDocument(assistant, doc._id)).rejects.toThrow(/droits/);
    await expect(deleteDocument(assistant, doc._id)).rejects.toThrow(/droits/);
    expect((await getDocumentForUser(ctx, doc._id)).status).toBe("VALIDE");
  });

  it("ignore un prescripteur d'une autre organisation à la création", async () => {
    const { ctx } = await setup();
    const other = await createTestOrg();
    const otherCtx = await createTestContext(other.org, other.centres);
    const foreign = (await createPrescriber(otherCtx, { lastName: "Externe", firstName: "Eve", email: "e@test.test", address: { line1: "1 rue B", postalCode: "75001", city: "Paris" } })).created!;
    const doc = await createDocument(ctx, "ADRESSAGE", { prescriberId: foreign.id });
    expect(doc.prescriberId).toBeNull();
  });
});
