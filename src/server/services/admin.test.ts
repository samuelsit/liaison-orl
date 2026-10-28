import { describe, expect, it } from "vitest";
import { createTestContext, createTestOrg, setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { defaultSettings } from "@/lib/brand";
import { inviteUser, listUsers, saveCentre, setUserActive, updateOrganization, updateSettings, updateUser } from "./admin";
import { computeStats, toCsv } from "./stats";
import { queryAudit } from "./audit-query";
import { createDocument } from "./documents";
import { getOrganization, invalidateOrganizationCache } from "@/server/repositories/organizations";

setupTestDb();

describe("administration", () => {
  it("réserve les réglages aux administrateurs et valide les paramètres", async () => {
    const { org, centres } = await createTestOrg();
    const audio = await createTestContext(org, centres);
    const admin = await createTestContext(org, centres, { role: "admin" });
    await expect(updateSettings(audio, defaultSettings())).rejects.toThrow(/administrateurs/);
    const bad = defaultSettings();
    bad.ai.commentMinLines = 9;
    bad.ai.commentMaxLines = 5;
    await expect(updateSettings(admin, bad)).rejects.toThrow(/minimal/);
    const ok = defaultSettings();
    ok.email.mode = "attachment";
    await updateSettings(admin, ok);
    expect((await collections().organizations().findOne({ _id: org._id }))?.settings.email.mode).toBe("attachment");
  });

  it("change de marque sans toucher au code (nom, couleurs) et rejette un logo invalide", async () => {
    const { org, centres } = await createTestOrg();
    const admin = await createTestContext(org, centres, { role: "admin" });
    const brand = { ...org.brand, name: "Nouvelle Marque", colors: { ...org.brand.colors, primary: "#0A6E5C" } };
    await updateOrganization(admin, { name: "Nouvelle Marque SAS", brand, legal: org.legal });
    const saved = await collections().organizations().findOne({ _id: org._id });
    expect(saved?.brand.name).toBe("Nouvelle Marque");
    expect(saved?.brand.colors.primary).toBe("#0A6E5C");
    await expect(updateOrganization(admin, { name: "X", brand: { ...brand, logo: "data:image/gif;base64,AAAA" }, legal: org.legal })).rejects.toThrow();
  });

  it("crée un centre et invite un utilisateur (e-mail d'activation)", async () => {
    const { org, centres } = await createTestOrg();
    const admin = await createTestContext(org, centres, { role: "admin" });
    const c = await saveCentre(admin, null, { name: "Rouen", address: { line1: "1 rue", postalCode: "76000", city: "Rouen" } });
    const id = await inviteUser(admin, { email: "nouvelle@test.test", firstName: "Nina", lastName: "Nouvelle", role: "assistant", centreIds: [c._id] });
    const user = await collections().users().findOne({ _id: id });
    expect(user).toMatchObject({ role: "assistant", centreIds: [c._id], active: true });
    const mail = await collections().outbox().findOne({ to: "nouvelle@test.test" });
    expect(mail?.kind).toBe("invitation");
    expect(mail?.html).toContain("bienvenue");
    await expect(inviteUser(admin, { email: "nouvelle@test.test", firstName: "N", lastName: "N", role: "assistant", centreIds: [c._id] })).rejects.toThrow(/existe déjà/);
    expect((await listUsers(admin)).some((u) => u.email === "nouvelle@test.test")).toBe(true);
  });

  it("empêche un administrateur de se rétrograder ou de se désactiver", async () => {
    const { org, centres } = await createTestOrg();
    const admin = await createTestContext(org, centres, { role: "admin" });
    await expect(updateUser(admin, admin.user.id, { firstName: "A", lastName: "B", title: "", role: "assistant", centreIds: [centres[0]!._id], canSend: false })).rejects.toThrow(/propre rôle/);
    await expect(setUserActive(admin, admin.user.id, false)).rejects.toThrow(/propre compte/);
  });
});

describe("statistiques et audit", () => {
  it("compte les documents par centre et par mois, et exporte en CSV", async () => {
    const { org, centres } = await createTestOrg();
    const ctx = await createTestContext(org, centres);
    const adr = await createDocument(ctx, "ADRESSAGE");
    await createDocument(ctx, "COMPTE_RENDU");
    await collections().documents().updateOne({ _id: adr._id }, { $set: { status: "VALIDE" } });
    const s = await computeStats({ role: "admin", organizationId: org._id }, 30);
    expect(s.totals.documents).toBe(2);
    // L'adressage validé est compté à part : il s'imprime, il n'est jamais « envoyé ».
    expect(s.totals).toMatchObject({ sent: 0, printableAdressages: 1 });
    expect(s.byCentre[0]).toMatchObject({ total: 2, adressage: 1, compteRendu: 1 });
    expect(s.monthly.at(-1)).toMatchObject({ adressage: 1, compteRendu: 1 });
    expect(toCsv(["a", "b"], [["x;y", 1]])).toBe('﻿a;b\r\n"x;y";1\r\n');
    const audit = await queryAudit({ role: "admin", organizationId: org._id }, { action: "document." });
    expect(audit.total).toBe(2);
  });

  it("complète les réglages ajoutés après la création de l'organisation", async () => {
    const { org } = await createTestOrg();
    await collections().organizations().updateOne({ _id: org._id }, { $unset: { "settings.ai.dictation": "" } });
    invalidateOrganizationCache();
    expect((await getOrganization(org._id))?.settings.ai.dictation).toBe(true);
  });

  it("refuse les statistiques et le journal à un non-administrateur", async () => {
    const { org } = await createTestOrg();
    await expect(computeStats({ role: "audioprothesiste", organizationId: org._id }, 30)).rejects.toThrow();
    await expect(queryAudit({ role: "assistant", organizationId: org._id }, {})).rejects.toThrow();
  });
});
