import { describe, expect, it } from "vitest";
import { setupTestDb } from "../../../tests/helpers";
import { collections } from "@/lib/db/collections";
import { createSecureLink, MAX_TOTAL_FAILURES, normalizeBirthDate, signAccess, verifyAccess, verifySecondFactor } from "./secure-links";

setupTestDb();

describe("liens sécurisés", () => {
  it("normalise les dates de naissance saisies", () => {
    expect(normalizeBirthDate("12/03/1946")).toBe("1946-03-12");
    expect(normalizeBirthDate("1/3/1946")).toBe("1946-03-01");
    expect(normalizeBirthDate("12031946")).toBe("1946-03-12");
    expect(normalizeBirthDate("1946-03-12")).toBe("1946-03-12");
    expect(normalizeBirthDate("hier")).toBeNull();
  });

  it("n'ouvre le document qu'avec la bonne date de naissance et verrouille après 5 essais", async () => {
    const { token, link } = await createSecureLink({ organizationId: "o", dispatchId: "d", documentId: "doc", pdfKey: "k", secondFactor: "birthdate", birthDate: "1946-03-12", validityDays: 30 });
    expect(link.factorHash).not.toContain("1946");
    expect((await collections().secureLinks().findOne({ _id: token }))).toBeNull();
    expect((await verifySecondFactor(token, "12/03/1946")).ok).toBe(true);
    for (let i = 0; i < 4; i++) expect((await verifySecondFactor(token, "01/01/1950")).ok).toBe(false);
    const locked = await verifySecondFactor(token, "02/02/1950");
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    expect((await verifySecondFactor(token, "12/03/1946")).ok).toBe(false);
  });

  it("des essais parallèles ne contournent pas le verrouillage", async () => {
    const { token } = await createSecureLink({ organizationId: "o", dispatchId: "d3", documentId: "doc", pdfKey: "k", secondFactor: "birthdate", birthDate: "1946-03-12", validityDays: 30 });
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => verifySecondFactor(token, `01/01/${1900 + i}`)));
    expect(results.filter((r) => !r.ok && r.reason === "wrong").length).toBeLessThanOrEqual(4);
    expect(results.filter((r) => !r.ok && r.reason === "locked").length).toBeGreaterThanOrEqual(26);
    expect((await verifySecondFactor(token, "12/03/1946")).ok).toBe(false);
  });

  it("révoque le lien après trop d'échecs cumulés", async () => {
    const { token } = await createSecureLink({ organizationId: "o", dispatchId: "d4", documentId: "doc", pdfKey: "k", secondFactor: "birthdate", birthDate: "1946-03-12", validityDays: 30 });
    for (let i = 0; i < MAX_TOTAL_FAILURES; i++) {
      await collections().secureLinks().updateMany({}, { $set: { lockedUntil: null } });
      await verifySecondFactor(token, "01/01/1950");
    }
    await collections().secureLinks().updateMany({}, { $set: { lockedUntil: null, attempts: 0 } });
    expect(await verifySecondFactor(token, "12/03/1946")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("refuse les liens expirés et accepte un code à usage séparé", async () => {
    const { token, code } = await createSecureLink({ organizationId: "o", dispatchId: "d2", documentId: "doc", pdfKey: "k", secondFactor: "code", birthDate: "", validityDays: 1 });
    expect(code).toMatch(/^\d{6}$/);
    expect((await verifySecondFactor(token, code!)).ok).toBe(true);
    await collections().secureLinks().updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await verifySecondFactor(token, code!)).toMatchObject({ ok: false, reason: "expired" });
    expect(await verifySecondFactor("jeton-inconnu-jeton-inconnu-jeton-inconnu", "x")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("signe un accès de courte durée", () => {
    const exp = Date.now() + 60_000;
    expect(verifyAccess("L", `${exp}.${signAccess("L", exp)}`)).toBe(true);
    expect(verifyAccess("L2", `${exp}.${signAccess("L", exp)}`)).toBe(false);
    expect(verifyAccess("L", `${Date.now() - 1}.${signAccess("L", Date.now() - 1)}`)).toBe(false);
  });
});
