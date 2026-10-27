import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { collections } from "@/lib/db/collections";
import type { CentreDoc, OrganizationDoc, PatientDoc, PrescriberDoc } from "@/lib/db/types";
import type { UserContext } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { formatPersonName } from "@/lib/text";
import type { AdressageData, CompteRenduData } from "@/lib/schemas/document";
import type { DispatchStatus } from "@/lib/schemas/dispatch";
import { createDocument, saveDraft, validateDocument } from "@/server/services/documents";
import { saveExtraction, uploadBilan } from "@/server/services/attachments";
import { extractBilan, generateComment } from "@/server/services/ai";
import { sendDocument } from "@/server/services/dispatch";
import { DEMO_BILANS, renderDemoBilan } from "./bilans";

export interface SeedContext {
  org: OrganizationDoc;
  centres: CentreDoc[];
  patients: PatientDoc[];
  prescribers: PrescriberDoc[];
  userIdByEmail: Map<string, string>;
  centreIdByKey: Map<string, string>;
}

export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

export function isoDaysAgo(n: number): string {
  return todayIso(daysAgo(n));
}

async function contextFor(s: SeedContext, email: string, centreKey: string): Promise<UserContext> {
  const u = (await collections().users().findOne({ email }))!;
  const centres = u.role === "admin" ? s.centres : s.centres.filter((c) => u.centreIds.includes(c._id));
  return {
    user: {
      id: u._id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: formatPersonName(u.firstName, u.lastName),
      title: u.title,
      role: u.role,
      organizationId: u.organizationId,
      centreIds: u.centreIds,
      canSend: u.canSend,
      twoFactorEnabled: Boolean(u.twoFactorEnabled),
      hasSignature: Boolean(u.signature),
    },
    organization: s.org,
    centres,
    activeCentre: centres.find((c) => c._id === s.centreIdByKey.get(centreKey)) ?? centres[0]!,
  };
}

const patientBy = (s: SeedContext, lastName: string) => s.patients.find((p) => p.lastName === lastName)!;

/** Recale les dates d'un document et de ses envois dans le passé (historique réaliste). */
async function backdate(docId: string, days: number) {
  const at = daysAgo(days + 0.1);
  const cap = (d: Date) => new Date(Math.min(d.getTime(), Date.now() - 60_000));
  const doc = await collections().documents().findOne({ _id: docId });
  await collections()
    .documents()
    .updateOne(
      { _id: docId },
      {
        $set: {
          createdAt: at,
          updatedAt: cap(new Date(at.getTime() + 3600_000)),
          validatedAt: doc?.validatedAt ? cap(new Date(at.getTime() + 1800_000)) : null,
        },
      },
    );
  const dispatches = await collections().dispatches().find({ documentId: docId }).toArray();
  for (const d of dispatches) {
    const sent = cap(new Date(at.getTime() + 2 * 3600_000));
    await collections()
      .dispatches()
      .updateOne(
        { _id: d._id },
        {
          $set: {
            createdAt: sent,
            updatedAt: cap(new Date(sent.getTime() + 86_400_000)),
            sentAt: sent,
            events: d.events.map((e, i) => ({ ...e, at: cap(new Date(sent.getTime() + i * 3_600_000)) })),
          },
        },
      );
  }
  await collections()
    .aiUsage()
    .updateMany({ at: { $gt: daysAgo(0.01) }, _id: { $exists: true } }, { $set: { at } });
}

async function setFinalStatus(docId: string, channel: "EMAIL" | "COURRIER", status: DispatchStatus, detail?: string) {
  const d = await collections().dispatches().findOne({ documentId: docId, channel });
  if (!d) return;
  const at = new Date(Math.min((d.sentAt ?? d.createdAt).getTime() + 86_400_000, Date.now() - 3 * 3_600_000));
  const events = [...d.events];
  if (channel === "EMAIL") {
    if (["delivered", "opened"].includes(status))
      events.push({ type: "email.delivered", at, status: "delivered", source: "mock" });
    if (status === "opened")
      events.push({
        type: "link.opened",
        at: new Date(at.getTime() + 7_200_000),
        status: "opened",
        source: "app",
        detail: "Document consulté par le destinataire",
      });
    if (status === "bounced") events.push({ type: "email.bounced", at, status: "bounced", source: "mock", detail });
  } else {
    if (["printing", "posted"].includes(status))
      events.push({ type: "letter.printing", at, status: "printing", source: "mock" });
    if (status === "posted")
      events.push({ type: "letter.sent", at: new Date(at.getTime() + 86_400_000), status: "posted", source: "mock" });
  }
  await collections()
    .dispatches()
    .updateOne(
      { _id: d._id },
      {
        $set: {
          status,
          events,
          deliveredAt: ["delivered", "opened"].includes(status) ? at : null,
          openedAt: status === "opened" ? new Date(at.getTime() + 7_200_000) : null,
          error:
            status === "bounced"
              ? {
                  code: "bounced",
                  message: "L'e-mail a été rejeté par le serveur du destinataire.",
                  hint: "Vérifiez l'adresse e-mail du prescripteur dans l'annuaire, puis renvoyez.",
                }
              : null,
        },
      },
    );
  const doc = await collections().documents().findOne({ _id: docId });
  if (doc) {
    const failing = status === "bounced";
    await collections()
      .documents()
      .updateOne(
        { _id: docId },
        {
          $set: {
            status: failing ? "ERREUR" : "ENVOYE",
            lastError: failing ? "L'e-mail a été rejeté par le serveur du destinataire." : null,
          },
        },
      );
  }
}

interface CrSpec {
  author: string;
  centre: string;
  patient: string;
  bilan?: string;
  confirm?: boolean;
  data: Partial<CompteRenduData>;
  validate?: boolean;
  send?: ("EMAIL" | "COURRIER")[];
  days: number;
  final?: ["EMAIL" | "COURRIER", DispatchStatus][];
}

async function seedCompteRendu(s: SeedContext, spec: CrSpec) {
  const ctx = await contextFor(s, spec.author, spec.centre);
  const p = patientBy(s, spec.patient);
  const doc = await createDocument(ctx, "COMPTE_RENDU", { patientId: p._id });
  let data: CompteRenduData = {
    ...(doc.data as CompteRenduData),
    reportDate: isoDaysAgo(spec.days),
    prescriptionDate: isoDaysAgo(spec.days + 35),
    ...spec.data,
  };
  if (spec.bilan) {
    const b = DEMO_BILANS.find((x) => x.file === spec.bilan)!;
    const file = await renderDemoBilan(b);
    const att = await uploadBilan(ctx, doc._id, { name: b.file, data: file.data });
    const a = await extractBilan(ctx, att._id);
    if (spec.confirm) {
      await saveExtraction(ctx, att._id, a, true);
      data = { ...data, attachmentId: att._id };
    }
  }
  await saveDraft(ctx, doc._id, { data, patientId: p._id, prescriberId: p.usualPrescriberId, aiFields: [] });
  if (spec.confirm && !data.comments) {
    const comment = await generateComment(ctx, doc._id, {
      data,
      patientId: p._id,
      prescriberId: p.usualPrescriberId,
      style: "standard",
    });
    data = { ...data, comments: comment };
    await saveDraft(ctx, doc._id, {
      data,
      patientId: p._id,
      prescriberId: p.usualPrescriberId,
      aiFields: spec.validate ? [] : ["comments", "degree", "ears"],
    });
  }
  if (spec.validate) {
    const v = await validateDocument(ctx, doc._id);
    if (!v.ok) throw new Error(`Seed : validation impossible (${JSON.stringify(v.errors)})`);
    if (spec.send?.length) await sendDocument(ctx, doc._id, { channels: spec.send });
  }
  await backdate(doc._id, spec.days);
  for (const [channel, status] of spec.final ?? []) await setFinalStatus(doc._id, channel, status);
  return doc._id;
}

interface AdrSpec {
  author: string;
  centre: string;
  patient: string;
  data: Partial<AdressageData>;
  validate?: boolean;
  send?: ("EMAIL" | "COURRIER")[];
  days: number;
  final?: ["EMAIL" | "COURRIER", DispatchStatus][];
}

async function seedAdressage(s: SeedContext, spec: AdrSpec) {
  const ctx = await contextFor(s, spec.author, spec.centre);
  const p = patientBy(s, spec.patient);
  const doc = await createDocument(ctx, "ADRESSAGE", { patientId: p._id });
  const data: AdressageData = { ...(doc.data as AdressageData), date: isoDaysAgo(spec.days), ...spec.data };
  await saveDraft(ctx, doc._id, { data, patientId: p._id, prescriberId: p.usualPrescriberId, aiFields: [] });
  if (spec.validate) {
    const v = await validateDocument(ctx, doc._id);
    if (!v.ok) throw new Error(`Seed : validation impossible (${JSON.stringify(v.errors)})`);
    if (spec.send?.length) await sendDocument(ctx, doc._id, { channels: spec.send });
  }
  await backdate(doc._id, spec.days);
  for (const [channel, status] of spec.final ?? []) await setFinalStatus(doc._id, channel, status);
  return doc._id;
}

const DEVICE: Partial<CompteRenduData> = {
  degree: "moyenne",
  ears: "deux",
  deviceType: "ecouteur_deporte",
  deviceBrand: "signia",
  deviceModel: "Pure Charge&Go IX 7",
  pricePerDevice: 1450,
  deviceClass: "2",
  rechargeable: true,
  customEarmolds: false,
  wearDuration: "3 semaines",
  wearHoursPerDay: 11,
  motivation: "active",
  handling: "oui",
};

/** Documents de démonstration à tous les statuts, avec bilans, envois et historique sur six mois. */
export async function seedDocuments(s: SeedContext): Promise<{ bilansDir: string }> {
  process.env.LORL_MOCK_FAST = "1";
  const bilansDir = path.resolve("demo/bilans");
  mkdirSync(bilansDir, { recursive: true });
  // Fichiers suivis par git : générés seulement s'ils manquent (le PDF contient sa date de création).
  for (const b of DEMO_BILANS) {
    const target = path.join(bilansDir, b.file);
    if (!existsSync(target)) writeFileSync(target, (await renderDemoBilan(b)).data);
  }

  const claire = "claire.morel@demo.test";
  const karim = "karim.haddad@demo.test";
  const julien = "julien.bernard@demo.test";
  const lea = "lea.petit@demo.test";

  // Envoyés (e-mail consulté, courrier distribué)
  await seedCompteRendu(s, {
    author: claire,
    centre: "pierrefitte",
    patient: "Durand",
    bilan: "bilan-durand-jeanne.pdf",
    confirm: true,
    data: DEVICE,
    validate: true,
    send: ["EMAIL", "COURRIER"],
    days: 9,
    final: [
      ["EMAIL", "opened"],
      ["COURRIER", "posted"],
    ],
  });
  await seedAdressage(s, {
    author: claire,
    centre: "pierrefitte",
    patient: "Martin",
    data: { exams: { conduits: true, bilan: true, autre: false } },
    validate: true,
    send: ["EMAIL"],
    days: 6,
    final: [["EMAIL", "delivered"]],
  });
  await seedCompteRendu(s, {
    author: julien,
    centre: "rouen",
    patient: "Hubert",
    data: {
      ...DEVICE,
      deviceBrand: "starkey",
      deviceModel: "Genesis AI 20",
      deviceType: "contour",
      customEarmolds: true,
      pricePerDevice: 1690,
      comments:
        "Appareillage bilatéral bien accepté, port régulier. Bonne compréhension en face à face, gêne résiduelle en milieu bruyant. Contrôle prévu à un mois.",
    },
    validate: true,
    send: ["EMAIL", "COURRIER"],
    days: 14,
    final: [
      ["EMAIL", "opened"],
      ["COURRIER", "posted"],
    ],
  });
  await seedAdressage(s, {
    author: julien,
    centre: "le-havre",
    patient: "Caron",
    data: { exams: { conduits: false, bilan: true, autre: false } },
    validate: true,
    send: ["EMAIL"],
    days: 3,
    final: [["EMAIL", "delivered"]],
  });

  // Erreur d'envoi (e-mail rejeté)
  await seedAdressage(s, {
    author: karim,
    centre: "saint-ouen",
    patient: "Aubert",
    data: {
      exams: { conduits: true, bilan: false, autre: true },
      autreText:
        "Suspicion de bouchon de cérumen à l'oreille gauche ; otalgie depuis une semaine. Merci de votre avis.",
    },
    validate: true,
    send: ["EMAIL"],
    days: 2,
    final: [["EMAIL", "bounced"]],
  });

  // Validés, prêts à envoyer (démonstration de l'envoi groupé)
  await seedAdressage(s, {
    author: claire,
    centre: "pierrefitte",
    patient: "Lefort",
    data: { exams: { conduits: true, bilan: false, autre: false } },
    validate: true,
    days: 1,
  });
  await seedCompteRendu(s, {
    author: claire,
    centre: "saint-denis",
    patient: "Petitjean",
    bilan: "photo-bilan-petitjean-gerard.jpg",
    confirm: true,
    data: { ...DEVICE, ears: "droite", degree: "severe", deviceType: "contour", deviceClass: "1" },
    validate: true,
    days: 1,
  });
  await seedAdressage(s, {
    author: julien,
    centre: "rouen",
    patient: "Guérin",
    data: { exams: { conduits: false, bilan: true, autre: false } },
    validate: true,
    days: 0,
  });

  // Brouillons à finir
  await seedAdressage(s, {
    author: lea,
    centre: "pierrefitte",
    patient: "Durand",
    data: { exams: { conduits: true, bilan: true, autre: false } },
    days: 0,
  });
  await seedCompteRendu(s, {
    author: claire,
    centre: "pierrefitte",
    patient: "Lefort",
    bilan: "photo-bilan-lefort-monique.jpg",
    confirm: false,
    data: { deviceBrand: "signia", deviceClass: "2", rechargeable: true },
    days: 0,
  });
  await seedCompteRendu(s, {
    author: karim,
    centre: "enghien",
    patient: "Simon",
    data: { deviceType: "intra", deviceBrand: "resound" },
    days: 1,
  });
  await seedCompteRendu(s, { author: julien, centre: "rouen", patient: "Royer", data: {}, days: 2 });

  // Cas limites de mise en page (PDF et version postale) : nom et adresse très longs, prescripteur
  // sans cabinet, commentaire de 15 lignes, apostrophes typographiques, une seule oreille sans bilan,
  // champs optionnels vides.
  const longComment = [
    "Séance d’adaptation : réglages affinés sur les fréquences aiguës ; « l’effet d’occlusion » a disparu après l’ouverture de l’évent. Le patient s’habitue progressivement aux bruits de l’environnement.",
    "Bonne compréhension en face à face, y compris au téléphone avec l’accessoire de diffusion. La télévision reste difficile à volume normal : un streamer TV est proposé à l’essai pendant quinze jours.",
    "Observance excellente (port quotidien de 12 h en moyenne d’après l’historique des aides). Manipulation acquise, y compris le changement des dômes et le nettoyage des écouteurs.",
    "Points de vigilance : acouphène gauche signalé en fin de journée, sans aggravation ; sensibilité aux bruits de vaisselle en cours d’atténuation. Merci de votre avis si l’acouphène persistait.",
    "Suite prévue : contrôle à un mois, puis tous les six mois ; nouveau bilan tonal et vocal à un an.",
  ].join("\n\n");
  await seedCompteRendu(s, {
    author: karim,
    centre: "saint-ouen",
    patient: "Van der Weyden-Saint-Exupéry",
    data: {
      ...DEVICE,
      deviceBrand: "autre",
      deviceBrandOther: "Phonak",
      deviceModel: "Audéo Sphere Infinio 90 – R (écouteur M, dôme ouvert)",
      comments: longComment,
    },
    validate: true,
    send: ["COURRIER"],
    days: 4,
    final: [["COURRIER", "posted"]],
  });
  await seedCompteRendu(s, {
    author: karim,
    centre: "montmorency",
    patient: "Leclerc",
    data: {
      ...DEVICE,
      ears: "droite",
      degree: "severe",
      deviceType: "contour",
      customEarmolds: true,
      comments:
        "Appareillage unilatéral droit ; oreille gauche normo-entendante. Adaptation rapide, port quotidien régulier.",
    },
    validate: true,
    days: 5,
  });
  await seedCompteRendu(s, { author: karim, centre: "aubervilliers", patient: "Barbier", data: {}, days: 0 });

  // Historique des six derniers mois (statistiques)
  const history: [string, string, string][] = [
    [claire, "pierrefitte", "Durand"],
    [claire, "saint-denis", "Belkacem"],
    [claire, "sarcelles", "Moreau"],
    [claire, "sarcelles", "Vasseur"],
    [karim, "montmorency", "Leclerc"],
    [karim, "saint-ouen", "Van der Weyden-Saint-Exupéry"],
    [karim, "aubervilliers", "Barbier"],
    [julien, "rouen", "Guérin"],
    [julien, "le-havre", "Leblanc"],
    [julien, "caen", "Joly"],
    [julien, "caen", "Gaillard"],
    [julien, "evreux", "Picard"],
  ];
  let day = 20;
  for (let round = 0; round < 3; round++) {
    for (const [author, centre, patient] of history) {
      day += 4 + ((round * 7 + day) % 5);
      const isCr = (day + round) % 3 !== 0;
      const send: ("EMAIL" | "COURRIER")[] =
        day % 4 === 0 ? ["EMAIL", "COURRIER"] : day % 5 === 0 ? ["COURRIER"] : ["EMAIL"];
      const final: ["EMAIL" | "COURRIER", DispatchStatus][] = send.map((c) => [
        c,
        c === "EMAIL" ? (day % 3 ? "opened" : "delivered") : "posted",
      ]);
      if (isCr) {
        await seedCompteRendu(s, {
          author,
          centre,
          patient,
          data: {
            ...DEVICE,
            deviceBrand: (["signia", "starkey", "resound"] as const)[day % 3],
            deviceClass: (["1", "2", "2"] as const)[day % 3],
            comments: "Appareillage bien accepté, observance satisfaisante. Contrôle prévu à un mois.",
          },
          validate: true,
          send,
          days: Math.min(day, 175),
          final,
        });
      } else {
        await seedAdressage(s, {
          author,
          centre,
          patient,
          data: { exams: { conduits: true, bilan: day % 2 === 0, autre: false } },
          validate: true,
          send,
          days: Math.min(day, 175),
          final,
        });
      }
    }
  }
  return { bilansDir };
}
