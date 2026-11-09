import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { countAllMeasures, prostheticGain, suggestDegree } from "@/lib/audiology/calculations";
import { getMeasure } from "@/lib/audiology/refs";
import { MAX_BILANS_PER_DOCUMENT } from "@/lib/schemas/attachment";
import { extractBilan } from "./ai";
import { deleteAttachment, rebuildBilan, saveBilan, setAttachmentCondition, uploadBilan } from "./attachments";
import { createDocument, getDocumentForUser } from "./documents";
import { createPatient } from "./patients";

setupTestDb();

const FILES = {
  tonale: "demo/bilans/bilan-moreau-andre-tonale.pdf",
  vocale: "demo/bilans/bilan-moreau-andre-vocale.pdf",
  gain: "demo/bilans/photo-moreau-andre-gain-appareils.jpg",
  lefortPhoto: "demo/bilans/photo-bilan-lefort-monique.jpg",
  lefortTonale: "demo/bilans/bilan-lefort-monique-tonale.pdf",
};

async function setup() {
  const { org, centres } = await createTestOrg();
  const ctx = await createTestContext(org, centres);
  const patient = (await createPatient(ctx, { civility: "M.", lastName: "Moreau", firstName: "André", birthDate: "1944-09-09" })).created!;
  const doc = await createDocument(ctx, "COMPTE_RENDU", { patientId: patient.id });
  const add = async (file: string) => {
    const att = await uploadBilan(ctx, doc._id, { name: file.split("/").pop()!, data: readFileSync(file) });
    return extractBilan(ctx, att._id);
  };
  return { ctx, doc, add };
}

describe("plusieurs fichiers de bilan fusionnés sur le compte rendu", () => {
  it("fusionne tonale, vocale et feuille avec appareils en une seule audiométrie exploitable", async () => {
    const { ctx, doc, add } = await setup();
    const [tonale, vocale, gain] = await Promise.all([add(FILES.tonale), add(FILES.vocale), add(FILES.gain)]);
    expect(gain.aidedSheet).toBe(true);
    expect(tonale.aidedSheet).toBe(false);
    // La lecture ne touche pas au bilan du document : la fusion est une étape à part.
    expect((await getDocumentForUser(ctx, doc._id)).bilan).toBeNull();

    const bilan = await rebuildBilan(ctx, doc._id);
    expect(bilan.confirmed).toBe(false);
    expect(bilan.conflicts).toEqual([]);
    const a = bilan.audiometry!;
    expect(getMeasure(a, { kind: "curve", path: "right.air", freq: "1000" })).toEqual({ value: 45, confidence: "high", source: tonale._id });
    expect(getMeasure(a, { kind: "speech", target: "right", key: "srt" })).toEqual({ value: 55, confidence: "high", source: vocale._id });
    expect(getMeasure(a, { kind: "curve", path: "right.aided", freq: "1000" })).toEqual({ value: 25, confidence: "medium", source: gain._id });
    expect(a.noise?.testName).toBe("VRB");
    expect(countAllMeasures(a)).toBeGreaterThan(30);
    expect(suggestDegree(a).degree).toBe("moyenne");
    const g = prostheticGain(a);
    expect(g.perEar.right?.reference).toBe("air");
    expect(g.perEar.right?.mean).toBe(21.3);
    expect(g.mean).not.toBeNull();
    expect(g.speech.srtGain).toBe(20);
  });

  it("confirme le bilan fusionné, puis retirer un fichier retire ses mesures et lève la confirmation", async () => {
    const { ctx, doc, add } = await setup();
    const vocale = await add(FILES.vocale);
    await add(FILES.tonale);
    const merged = await rebuildBilan(ctx, doc._id);
    const confirmed = await saveBilan(ctx, doc._id, merged.audiometry, true);
    expect(confirmed.confirmed).toBe(true);
    expect(confirmed.confirmedBy).toBe(ctx.user.id);
    expect((await getDocumentForUser(ctx, doc._id)).bilan?.confirmed).toBe(true);
    const audits = await collections().auditLogs().find({ action: "bilan.confirm", entityId: doc._id }).toArray();
    expect(audits).toHaveLength(1);

    const after = await deleteAttachment(ctx, vocale._id);
    expect(after.confirmed).toBe(false);
    expect(getMeasure(after.audiometry!, { kind: "speech", target: "right", key: "srt" })).toBeNull();
    expect(getMeasure(after.audiometry!, { kind: "curve", path: "right.air", freq: "1000" })?.value).toBe(45);
    expect(await collections().attachments().countDocuments({ documentId: doc._id })).toBe(1);
  });

  it("conserve les corrections manuelles au recalcul et réinterprète un fichier « avec appareils »", async () => {
    const { ctx, doc, add } = await setup();
    const tonale = await add(FILES.tonale);
    const first = await rebuildBilan(ctx, doc._id);
    // L'audioprothésiste corrige une case à la main (sans provenance).
    const edited = structuredClone(first.audiometry!);
    edited.right.air["1000"] = { value: 50, confidence: "high" };
    await saveBilan(ctx, doc._id, edited, false);
    await add(FILES.vocale);
    const second = await rebuildBilan(ctx, doc._id);
    expect(getMeasure(second.audiometry!, { kind: "curve", path: "right.air", freq: "1000" })).toEqual({ value: 50, confidence: "high" });

    const { attachment, bilan } = await setAttachmentCondition(ctx, tonale._id, "aided");
    expect(attachment.condition).toBe("aided");
    expect(bilan.audiometry!.right.air["500"]).toBeUndefined();
    expect(getMeasure(bilan.audiometry!, { kind: "curve", path: "right.aided", freq: "500" })?.value).toBe(40);
    // La valeur manuelle reste à sa place.
    expect(getMeasure(bilan.audiometry!, { kind: "curve", path: "right.air", freq: "1000" })).toEqual({ value: 50, confidence: "high" });
    await expect(setAttachmentCondition(ctx, tonale._id, "n'importe quoi")).rejects.toThrow();
  });

  it("signale les conflits entre deux lectures du même seuil et les lève quand la case est corrigée", async () => {
    const { ctx, doc, add } = await setup();
    const photo = await add(FILES.lefortPhoto);
    const pdf = await add(FILES.lefortTonale);
    const bilan = await rebuildBilan(ctx, doc._id);
    const refs = bilan.conflicts.map((c) => c.ref);
    expect(refs).toEqual([
      { kind: "curve", path: "right.air", freq: "1000" },
      { kind: "curve", path: "right.air", freq: "2000" },
    ]);
    // Le PDF (confiance haute) l'emporte sur la photo (moyenne) ; la case retenue passe en confiance faible.
    expect(bilan.conflicts[0]?.kept.attachmentId).toBe(pdf._id);
    expect(bilan.conflicts[0]?.others[0]?.attachmentId).toBe(photo._id);
    expect(getMeasure(bilan.audiometry!, { kind: "curve", path: "right.air", freq: "1000" })).toEqual({ value: 45, confidence: "low", source: pdf._id });

    const fixed = structuredClone(bilan.audiometry!);
    fixed.right.air["1000"] = { value: 40, confidence: "high" };
    const saved = await saveBilan(ctx, doc._id, fixed, false);
    expect(saved.conflicts.map((c) => c.ref)).toEqual([{ kind: "curve", path: "right.air", freq: "2000" }]);
  });

  it("refuse un septième fichier et un fichier sur un document qui n'est plus un brouillon", async () => {
    const { ctx, doc } = await setup();
    const data = readFileSync(FILES.tonale);
    for (let i = 0; i < MAX_BILANS_PER_DOCUMENT; i++) await uploadBilan(ctx, doc._id, { name: `b${i}.pdf`, data });
    await expect(uploadBilan(ctx, doc._id, { name: "trop.pdf", data })).rejects.toThrow(/Au plus 6 fichiers/);
    await collections().documents().updateOne({ _id: doc._id }, { $set: { status: "VALIDE" } });
    await expect(rebuildBilan(ctx, doc._id)).rejects.toThrow(/Rouvrez/);
    await expect(saveBilan(ctx, doc._id, null, true)).rejects.toThrow(/Rouvrez/);
  });
});
