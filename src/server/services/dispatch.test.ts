import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { createDocument, getDocumentForUser, saveDraft, validateDocument } from "./documents";
import { createPatient } from "./patients";
import { createPrescriber } from "./prescribers";
import { bulkSend, prepareDispatch, retryDispatch, sendDocument } from "./dispatch";
import { handlePingenEvent, handleResendEvent } from "./webhooks";
import { verifySecondFactor } from "./secure-links";

setupTestDb();

async function validatedDoc(opts: { city?: string; email?: string } = {}) {
  const { org, centres } = await createTestOrg();
  const ctx = await createTestContext(org, centres);
  const patient = (await createPatient(ctx, { civility: "M.", lastName: "Martin", firstName: "Robert", birthDate: "1941-11-02" })).created!;
  const prescriber = (
    await createPrescriber(
      ctx,
      {
        lastName: `Lefèvre${Math.random()}`,
        firstName: "Antoine",
        email: opts.email ?? "a.lefevre@test.test",
        preferredChannel: "both",
        address: { line1: "5 rue Gabriel Péri", postalCode: "93200", city: opts.city ?? "Saint-Denis" },
      },
      { force: true },
    )
  ).created!;
  const doc = await createDocument(ctx, "ADRESSAGE");
  await saveDraft(ctx, doc._id, { data: { ...doc.data, exams: { conduits: true, bilan: true, autre: false } }, patientId: patient.id, prescriberId: prescriber.id, aiFields: [] });
  const v = await validateDocument(ctx, doc._id);
  expect(v.ok).toBe(true);
  return { ctx, doc, patient, prescriber };
}

describe("préparation de l'envoi", () => {
  it("propose les canaux préférés, l'objet minimisé et une estimation du courrier", async () => {
    const { ctx, doc } = await validatedDoc();
    const plan = await prepareDispatch(ctx, doc._id);
    expect(plan.defaultChannels).toEqual(["EMAIL", "COURRIER"]);
    expect(plan.email.subject).toBe("Courrier d'adressage — R. M.");
    expect(plan.email.bodyText).not.toMatch(/Martin/i);
    expect(plan.postal.addressLines.at(-1)).toBe("FRANCE");
    expect(plan.postal.pages).toBe(2);
    expect(plan.postal.estimate?.cents).toBeGreaterThan(0);
  });

  it("refuse l'envoi d'un brouillon", async () => {
    const { org, centres } = await createTestOrg();
    const ctx = await createTestContext(org, centres);
    const doc = await createDocument(ctx, "ADRESSAGE");
    await expect(prepareDispatch(ctx, doc._id)).rejects.toThrow(/Validez/);
  });
});

describe("envoi par e-mail et courrier (mode démo)", () => {
  it("envoie, crée un lien sécurisé, passe le document en ENVOYÉ et reste idempotent", async () => {
    const { ctx, doc } = await validatedDoc();
    const sent = await sendDocument(ctx, doc._id, { channels: ["EMAIL", "COURRIER"] });
    expect(sent.map((d) => [d.channel, d.status])).toEqual([
      ["EMAIL", "sent"],
      ["COURRIER", "sent"],
    ]);
    expect(sent[1]!.costCents).toBeGreaterThan(0);
    expect((await getDocumentForUser(ctx, doc._id)).status).toBe("ENVOYE");
    const mail = await collections().outbox().findOne({ externalId: sent[0]!.externalId! });
    expect(mail?.subject).toBe("Courrier d'adressage — R. M.");
    expect(mail?.attachments).toEqual([]);
    const token = /\/l\/([A-Za-z0-9_-]+)/.exec(mail!.html)![1]!;
    expect((await verifySecondFactor(token, "02/11/1941")).ok).toBe(true);
    // Double clic : aucun second envoi.
    const again = await sendDocument(ctx, doc._id, { channels: ["EMAIL"] });
    expect(again[0]!._id).toBe(sent[0]!._id);
    expect(await collections().dispatches().countDocuments({ documentId: doc._id })).toBe(2);
    // Renvoi explicite : nouvelle tentative.
    const resent = await retryDispatch(ctx, sent[0]!._id);
    expect(resent[0]!._id).not.toBe(sent[0]!._id);
    expect(resent[0]!.idempotencyKey).toMatch(/:EMAIL:2$/);
  });

  it("signale une adresse refusée par le prestataire avec une action de correction", async () => {
    const { ctx, doc } = await validatedDoc({ city: "Ville inconnue" });
    const [d] = await sendDocument(ctx, doc._id, { channels: ["COURRIER"] });
    expect(d!.status).toBe("action_required");
    expect(d!.error?.hint).toMatch(/Corrigez l'adresse/);
    expect((await getDocumentForUser(ctx, doc._id)).status).toBe("ERREUR");
  });

  it("envoie un lot selon le canal préféré et explique les impossibilités", async () => {
    const a = await validatedDoc();
    const b = await createDocument(a.ctx, "ADRESSAGE");
    const res = await bulkSend(a.ctx, [a.doc._id, b._id]);
    expect(res[0]).toMatchObject({ ok: true, channels: ["EMAIL", "COURRIER"] });
    expect(res[1]).toMatchObject({ ok: false });
  });
});

describe("webhooks", () => {
  it("met à jour les statuts e-mail et ignore les rejeux", async () => {
    const { ctx, doc } = await validatedDoc();
    const [d] = await sendDocument(ctx, doc._id, { channels: ["EMAIL"] });
    await collections().dispatches().updateOne({ _id: d!._id }, { $set: { provider: "resend", externalId: "email_123" } });
    expect(await handleResendEvent({ type: "email.delivered", data: { email_id: "email_123" } }, "msg_1")).toBe("ok");
    await handleResendEvent({ type: "email.delivered", data: { email_id: "email_123" } }, "msg_1");
    let fresh = await collections().dispatches().findOne({ _id: d!._id });
    expect(fresh?.status).toBe("delivered");
    expect(fresh?.events.filter((e) => e.externalEventId === "msg_1")).toHaveLength(1);
    await handleResendEvent({ type: "email.bounced", data: { email_id: "email_123", bounce: { message: "550" } } }, "msg_2");
    fresh = await collections().dispatches().findOne({ _id: d!._id });
    expect(fresh?.status).toBe("bounced");
    expect((await getDocumentForUser(ctx, doc._id)).status).toBe("ERREUR");
    expect(await handleResendEvent({ type: "email.delivered", data: { email_id: "inconnu" } }, "msg_3")).toBe("ignored");
  });

  it("traite les notifications Pingen (remise à La Poste, non distribuable)", async () => {
    const { ctx, doc } = await validatedDoc();
    const [d] = await sendDocument(ctx, doc._id, { channels: ["COURRIER"] });
    await collections().dispatches().updateOne({ _id: d!._id }, { $set: { provider: "pingen", externalId: "letter_1" } });
    await handlePingenEvent({ data: { id: "evt_1", type: "webhook_sent", relationships: { deliverable: { data: { id: "letter_1" } } } } });
    expect((await collections().dispatches().findOne({ _id: d!._id }))?.status).toBe("posted");
    await handlePingenEvent({ data: { id: "evt_2", type: "webhook_undeliverable", attributes: { reason: "Recipient moved" }, relationships: { letter: { data: { id: "letter_1" } } } } });
    const fresh = await collections().dispatches().findOne({ _id: d!._id });
    expect(fresh?.status).toBe("undeliverable");
    expect(fresh?.error?.message).toMatch(/distribué/);
  });
});
