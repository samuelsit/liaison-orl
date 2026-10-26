import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { base32 } from "@better-auth/utils/base32";
import { db } from "@/lib/db/client";
import { COLLECTIONS, collections } from "@/lib/db/collections";
import { ensureIndexes } from "@/lib/db/indexes";
import type { CentreDoc, OrganizationDoc, PatientDoc, PrescriberDoc } from "@/lib/db/types";
import { DEFAULT_COLORS, DEFAULT_FONTS, defaultSettings } from "@/lib/brand";
import { DEMO_ACCOUNTS, DEMO_ADMIN_TOTP_SECRET, DEMO_PASSWORD } from "@/lib/demo";
import { patientSearchText, prescriberSearchText } from "@/lib/search-text";
import { enableTotpWithSecret, provisionUser } from "@/server/services/users";
import { CENTRES, PATIENTS, PRESCRIBERS, USERS } from "./data";
import { fakeSignature } from "./signature";
import { seedDocuments } from "./documents";
import { setAiProvider } from "@/ai";
import { MockAiProvider } from "@/ai/mock";
import { setEmailProvider } from "@/server/services/email";
import { MockEmailProvider } from "@/server/services/email/mock";
import { setPostalProvider } from "@/server/services/postal";
import { MockPostalProvider } from "@/server/services/postal/mock";

export interface SeedSummary {
  counts: Record<string, number>;
  accounts: { email: string; role: string }[];
  password: string;
  totpBase32: string;
  bilansDir: string;
}

function fakeRpps(i: number): string {
  return `10${String(100000000 + i * 7919).slice(0, 9)}`;
}

export async function runSeed(opts: { force?: boolean } = {}): Promise<SeedSummary> {
  const database = db();
  const existingOrg = await collections().organizations().findOne({});
  if (existingOrg && !existingOrg.demo && !opts.force) {
    throw new Error("La base contient une organisation réelle (non démo). Seed annulé pour ne rien écraser.");
  }

  for (const name of Object.values(COLLECTIONS)) {
    await database.collection(name).deleteMany({});
  }
  for (const name of ["files.files", "files.chunks", "rateLimit"]) {
    await database.collection(name).deleteMany({});
  }
  await ensureIndexes();

  const now = new Date();
  const logo = `data:image/png;base64,${readFileSync(path.resolve("assets/brand/logo-default.png")).toString("base64")}`;
  const orgId = randomUUID();
  const org: OrganizationDoc = {
    _id: orgId,
    name: "Harmonie Audition",
    brand: {
      name: "Harmonie Audition",
      slogan: "BIEN ENTENDRE, MIEUX VIVRE",
      logo,
      colors: { ...DEFAULT_COLORS },
      fonts: { ...DEFAULT_FONTS },
    },
    legal: { companyName: "Harmonie Audition (démonstration)", mentions: "Données de démonstration — aucune donnée réelle." },
    settings: defaultSettings(),
    demo: true,
    createdAt: now,
    updatedAt: now,
  };
  await collections().organizations().insertOne(org);

  const centreIdByKey = new Map<string, string>();
  const centres: CentreDoc[] = CENTRES.map((c) => {
    const id = randomUUID();
    centreIdByKey.set(c.key, id);
    return {
      _id: id,
      organizationId: orgId,
      name: c.name,
      address: { line1: c.line1, line2: "", postalCode: c.postalCode, city: c.city, country: "FRANCE" },
      phone: c.phone,
      email: `${c.key}@demo.test`,
      defaultSignature: `L'équipe du centre de ${c.name}`,
      senderAddress: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  });
  await collections().centres().insertMany(centres);
  const centreIds = (keys: string[]) => keys.map((k) => centreIdByKey.get(k)!).filter(Boolean);

  const userIdByEmail = new Map<string, string>();
  let sigSeed = 1;
  for (const u of USERS) {
    const id = await provisionUser(
      {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        title: u.title,
        role: u.role,
        organizationId: orgId,
        centreIds: u.centres === "all" ? centres.map((c) => c._id) : centreIds(u.centres),
        canSend: u.canSend,
        signature: u.signature ? await fakeSignature(sigSeed++) : null,
      },
      DEMO_PASSWORD,
    );
    userIdByEmail.set(u.email, id);
  }
  const adminId = userIdByEmail.get("direction@demo.test")!;
  await enableTotpWithSecret(adminId, DEMO_ADMIN_TOTP_SECRET);

  const prescribers: PrescriberDoc[] = PRESCRIBERS.map((p, i) => {
    const base = {
      civility: p.civility,
      firstName: p.firstName,
      lastName: p.lastName,
      specialty: p.specialty,
      practiceName: p.practiceName,
      email: p.email,
      address: { line1: p.line1, line2: p.line2 ?? "", postalCode: p.postalCode, city: p.city, country: "FRANCE" },
    };
    return {
      _id: randomUUID(),
      organizationId: orgId,
      ...base,
      rpps: i % 3 === 0 ? fakeRpps(i) : "",
      phone: p.phone,
      preferredChannel: p.channel,
      salutation: p.salutation,
      notes: i === 2 ? "Préfère recevoir les comptes rendus par courrier. Secrétariat joignable le matin." : "",
      centreIds: centreIds(p.centres),
      favoriteOf: (p.favoriteOf ?? []).map((e) => userIdByEmail.get(e)!).filter(Boolean),
      archived: false,
      searchText: prescriberSearchText(base),
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
    };
  });
  await collections().prescribers().insertMany(prescribers);

  const patients: PatientDoc[] = PATIENTS.map((p) => ({
    _id: randomUUID(),
    organizationId: orgId,
    civility: p.civility,
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate,
    centreId: centreIdByKey.get(p.centre)!,
    usualPrescriberId: prescribers[p.prescriberIndex]?._id ?? null,
    searchText: patientSearchText(p),
    createdBy: adminId,
    createdAt: now,
    updatedAt: now,
  }));
  await collections().patients().insertMany(patients);

  // Les documents de démonstration ne déclenchent jamais d'envoi ni d'appel réel.
  setAiProvider(new MockAiProvider());
  setEmailProvider(new MockEmailProvider());
  setPostalProvider(new MockPostalProvider());
  const docSummary = await seedDocuments({ org, centres, patients, prescribers, userIdByEmail, centreIdByKey });
  setAiProvider(null);
  setEmailProvider(null);
  setPostalProvider(null);

  const counts: Record<string, number> = {};
  for (const [label, name] of [
    ["Organisations", COLLECTIONS.organizations],
    ["Centres", COLLECTIONS.centres],
    ["Utilisateurs", COLLECTIONS.users],
    ["Prescripteurs", COLLECTIONS.prescribers],
    ["Patients", COLLECTIONS.patients],
    ["Documents", COLLECTIONS.documents],
    ["Pièces jointes", COLLECTIONS.attachments],
    ["Envois", COLLECTIONS.dispatches],
  ] as const) {
    counts[label] = await database.collection(name).countDocuments();
  }

  return {
    counts,
    accounts: DEMO_ACCOUNTS.map((a) => ({ email: a.email, role: a.label })),
    password: DEMO_PASSWORD,
    totpBase32: base32.encode(DEMO_ADMIN_TOTP_SECRET, { padding: false }),
    bilansDir: docSummary.bilansDir,
  };
}
