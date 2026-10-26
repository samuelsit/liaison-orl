import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { setAiProvider } from "@/ai";
import { MockAiProvider } from "@/ai/mock";
import type { AiProvider, CommentRequest } from "@/ai/types";
import { collections } from "@/lib/db/collections";
import { createDocument, saveDraft } from "./documents";
import { uploadBilan, saveExtraction } from "./attachments";
import { extractBilan, generateComment, reformulateMotif } from "./ai";
import { createPatient } from "./patients";

setupTestDb();
afterEach(() => setAiProvider(null));

async function setup() {
  const { org, centres } = await createTestOrg();
  const ctx = await createTestContext(org, centres);
  const patient = (await createPatient(ctx, { civility: "Mme", lastName: "Durand", firstName: "Jeanne", birthDate: "1946-03-12" })).created!;
  const doc = await createDocument(ctx, "COMPTE_RENDU", { patientId: patient.id });
  return { ctx, patient, doc };
}

describe("lecture du bilan (mode démo)", () => {
  it("relit exactement un bilan fictif et journalise la consommation", async () => {
    const { ctx, doc } = await setup();
    const file = readFileSync("demo/bilans/bilan-durand-jeanne.pdf");
    const att = await uploadBilan(ctx, doc._id, { name: "bilan.pdf", data: file });
    const a = await extractBilan(ctx, att._id);
    expect(a.right.air["1000"]).toEqual({ value: 45, confidence: "high" });
    expect(a.freeField.speechAided.maxScore?.value).toBe(90);
    expect(a.noise?.testName).toBe("Test de phrases dans le bruit");
    const usage = await collections().aiUsage().find({ organizationId: ctx.user.organizationId }).toArray();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ kind: "extraction", mock: true, success: true, costMicroUsd: 0 });
  });

  it("conserve le marqueur des photos de démonstration malgré le nettoyage EXIF", async () => {
    const { ctx, doc } = await setup();
    const att = await uploadBilan(ctx, doc._id, { name: "photo.jpg", data: readFileSync("demo/bilans/photo-bilan-petitjean-gerard.jpg") });
    const a = await extractBilan(ctx, att._id);
    expect(a.right.air["4000"]).toEqual({ value: 85, confidence: "low" });
  });

  it("refuse les fichiers qui ne sont ni PDF ni image", async () => {
    const { ctx, doc } = await setup();
    await expect(uploadBilan(ctx, doc._id, { name: "x.exe", data: Buffer.from("MZ....") })).rejects.toThrow(/Format non reconnu/);
  });

  it("réessaie une fois puis bascule en saisie manuelle si la sortie est invalide", async () => {
    const { ctx, doc } = await setup();
    let calls = 0;
    const bad: AiProvider = new MockAiProvider();
    bad.extract = async () => {
      calls++;
      return { raw: { pas: "conforme" }, usage: { model: "x", mock: true, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } };
    };
    setAiProvider(bad);
    const att = await uploadBilan(ctx, doc._id, { name: "bilan.pdf", data: readFileSync("demo/bilans/bilan-martin-robert.pdf") });
    await expect(extractBilan(ctx, att._id)).rejects.toThrow(/manuellement/);
    expect(calls).toBe(2);
    expect((await collections().attachments().findOne({ _id: att._id }))?.extractionStatus).toBe("failed");
  });
});

describe("rédactions pseudonymisées", () => {
  it("n'envoie aucune donnée d'identité et réinjecte le nom", async () => {
    const { ctx, patient, doc } = await setup();
    const att = await uploadBilan(ctx, doc._id, { name: "bilan.pdf", data: readFileSync("demo/bilans/bilan-durand-jeanne.pdf") });
    const a = await extractBilan(ctx, att._id);
    await saveExtraction(ctx, att._id, a, true);
    let captured: CommentRequest | null = null;
    const spy = new MockAiProvider();
    const original = spy.writeComment.bind(spy);
    spy.writeComment = async (req) => {
      captured = req;
      const r = await original(req);
      return { ...r, raw: { comment: `Nous avons appareillé [PATIENT]. ${(r.raw as { comment: string }).comment}` } };
    };
    setAiProvider(spy);
    const data = { ...doc.data, attachmentId: att._id, ears: "deux", comments: "Jeanne Durand est satisfaite." };
    await saveDraft(ctx, doc._id, { data, patientId: patient.id, prescriberId: null, aiFields: [] });
    const comment = await generateComment(ctx, doc._id, { data, patientId: patient.id, prescriberId: null, style: "standard" });
    expect(JSON.stringify(captured)).not.toMatch(/Durand|Jeanne|1946/i);
    expect(JSON.stringify(captured)).toContain("[PATIENT] est satisfaite");
    expect(comment).toContain("Mme DURAND");
    expect(comment).toMatch(/gain tonal moyen/i);
  });

  it("reformule le motif sans laisser passer le nom du patient", async () => {
    const { ctx, patient } = await setup();
    const adr = await createDocument(ctx, "ADRESSAGE", { patientId: patient.id });
    let sent = "";
    const spy = new MockAiProvider();
    const original = spy.reformulateMotif.bind(spy);
    spy.reformulateMotif = async (notes) => {
      sent = notes;
      return original(notes);
    };
    setAiProvider(spy);
    const motif = await reformulateMotif(ctx, adr._id, { notes: "Mme Durand : bouchon OD", patientId: patient.id, prescriberId: null });
    expect(sent).toBe("[PATIENT] : bouchon OD");
    expect(motif).toContain("Mme DURAND");
  });
});
