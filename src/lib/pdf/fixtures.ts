import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DEFAULT_COLORS } from "@/lib/brand";
import { emptyAdressage, emptyCompteRendu } from "@/lib/documents/defaults";
import { emptyAudiometry, type Audiometry, type Curve } from "@/lib/schemas/audiometry";
import type { PdfModel, PdfPrescriber } from "./model";

/**
 * Jeux de données des documents : cas nominaux et cas limites (noms et adresses très longs,
 * prescripteur sans cabinet, commentaire de 15 lignes, sans bilan, une seule oreille, champs
 * optionnels vides, accents et apostrophes typographiques). Servent au script
 * `npm run render:docs`, aux tests de zones Pingen et aux tests de non-régression visuelle.
 */
export interface PdfFixture {
  name: string;
  model: PdfModel;
}

const DATE = "2026-10-27";

function curve(values: Record<string, number>): Curve {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, confidence: "high" as const }]));
}

export function sampleAudiometry(): Audiometry {
  const a = emptyAudiometry();
  a.right.air = curve({
    "125": 20,
    "250": 25,
    "500": 35,
    "1000": 45,
    "2000": 55,
    "3000": 60,
    "4000": 65,
    "6000": 70,
    "8000": 75,
  });
  a.right.bone = curve({ "250": 20, "500": 30, "1000": 40, "2000": 50, "4000": 60 });
  a.left.air = curve({
    "125": 15,
    "250": 20,
    "500": 30,
    "1000": 40,
    "2000": 50,
    "3000": 60,
    "4000": 70,
    "6000": 75,
    "8000": 80,
  });
  a.left.bone = curve({ "250": 15, "500": 25, "1000": 35, "2000": 45, "4000": 60 });
  a.freeField.unaided = curve({ "250": 30, "500": 40, "1000": 45, "2000": 55, "4000": 65 });
  a.freeField.aided = curve({ "250": 25, "500": 25, "1000": 25, "2000": 30, "4000": 40 });
  a.freeField.speechUnaided = {
    srt: { value: 55, confidence: "high" },
    maxScore: { value: 60, confidence: "high" },
    maxScoreLevel: { value: 70, confidence: "high" },
  };
  a.freeField.speechAided = {
    srt: { value: 35, confidence: "high" },
    maxScore: { value: 90, confidence: "high" },
    maxScoreLevel: { value: 60, confidence: "high" },
  };
  return a;
}

function rightEarOnly(): Audiometry {
  const a = emptyAudiometry();
  a.right.air = curve({ "250": 35, "500": 45, "1000": 55, "2000": 60, "4000": 70, "8000": 85 });
  a.right.bone = curve({ "500": 40, "1000": 50, "2000": 55, "4000": 65 });
  a.right.air["8000"] = { value: null, confidence: "high", noResponse: true };
  a.freeField.unaided = curve({ "500": 50, "1000": 55, "2000": 60, "4000": 70 });
  a.freeField.aided = curve({ "500": 30, "1000": 30, "2000": 35, "4000": 45 });
  return a;
}

let signaturePromise: Promise<string> | null = null;
/** Signature manuscrite fictive (tracé vectoriel converti en PNG). */
export function sampleSignature(): Promise<string> {
  signaturePromise ??= (async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110" viewBox="0 0 300 110"><path d="M 20 70 C 40 12, 70 14, 70 60 S 95 96, 120 44 S 150 20, 165 66 S 200 80, 220 40 S 255 30, 270 62 M 60 82 C 120 70, 200 92, 285 72" fill="none" stroke="#1d2b5a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  })();
  return signaturePromise;
}

export function defaultLogo(): string {
  return `data:image/png;base64,${readFileSync(path.join(process.cwd(), "assets/brand/logo-default.png")).toString("base64")}`;
}

const lefevre: PdfPrescriber = {
  civility: "Dr",
  firstName: "Antoine",
  lastName: "Lefèvre",
  salutation: "Cher Confrère",
  practiceName: "Cabinet ORL de la Basilique",
  address: { line1: "5 rue Gabriel Péri", line2: "", postalCode: "93200", city: "Saint-Denis", country: "FRANCE" },
};

/** Cas limite : nom et adresse très longs, sans cabinet, apostrophes et accents. */
const longPrescriber: PdfPrescriber = {
  civility: "Pr",
  firstName: "Marie-Clémentine",
  lastName: "de La Rochefoucauld-d'Estréville",
  salutation: "Chère Professeure",
  practiceName: "",
  address: {
    line1: "128 boulevard du Maréchal de Lattre de Tassigny",
    line2: "Bâtiment B, escalier 3, 2e étage",
    postalCode: "92100",
    city: "Boulogne-Billancourt",
    country: "FRANCE",
  },
};

export async function pdfFixtures(): Promise<PdfFixture[]> {
  const signature = await sampleSignature();
  const base = {
    brand: {
      name: "Harmonie Audition",
      logo: defaultLogo(),
      colors: DEFAULT_COLORS,
      font: "Inter" as const,
      legal: "Harmonie Audition — exemple de mentions légales · RCS et SIRET du centre",
    },
    centre: {
      name: "Pierrefitte-sur-Seine",
      displayName: "Harmonie Audition — Pierrefitte-sur-Seine",
      address: {
        line1: "129 boulevard Jean Mermoz",
        line2: "",
        postalCode: "93380",
        city: "Pierrefitte-sur-Seine",
        country: "FRANCE",
      },
      phone: "01 80 89 34 53",
      email: "pierrefitte@harmonie-audition.fr",
      senderAddress: null,
    },
    author: { firstName: "Claire", lastName: "Morel", title: "Audioprothésiste D.E", signature, rpps: "10101234567" },
    patient: { civility: "Mme", firstName: "Jeanne", lastName: "Dupont", birthDate: "1948-03-12" },
    prescriber: lefevre,
    showSignature: true,
    defaultSalutation: "Cher(e) Docteur",
    draft: false,
  };
  const longPatient = {
    civility: "M.",
    firstName: "Jean-Christophe",
    lastName: "Van der Weyden-Saint-Exupéry",
    birthDate: "1939-01-01",
  };

  const fullCr = {
    ...emptyCompteRendu(DATE),
    prescriptionDate: "2026-09-02",
    degree: "moyenne" as const,
    ears: "deux" as const,
    deviceType: "ecouteur_deporte" as const,
    deviceBrand: "signia" as const,
    deviceModel: "Pure Charge&Go IX 7",
    pricePerDevice: 1450,
    deviceClass: "2" as const,
    rechargeable: true,
    customEarmolds: false,
    wearDuration: "3 semaines",
    wearHoursPerDay: 11,
    motivation: "active" as const,
    handling: "oui" as const,
    comments:
      "Appareillage stéréophonique bien toléré. Gain tonal moyen de 24 dB, avec une amélioration du seuil d'intelligibilité de 20 dB et un gain de 30 points en intelligibilité maximale.\n\nPort quotidien régulier (11 h/jour), manipulation acquise. La patiente rapporte un net confort dans les conversations familiales ; quelques difficultés persistent en milieu bruyant.\n\nContrôle prévu à un mois, puis tous les six mois.",
    includeAnnex: true,
  };

  const longComment = Array.from({ length: 5 }, (_, i) =>
    [
      `Séance ${i + 1} : réglages affinés sur les fréquences aiguës, « l'effet d'occlusion » a disparu après l'ouverture de l'évent ; le patient s'habitue progressivement aux bruits de l'environnement.`,
      "Bonne compréhension en face à face ; la télévision reste difficile à volume normal, un accessoire de diffusion est proposé.",
    ].join(" "),
  ).join("\n\n");

  return [
    {
      name: "adressage",
      model: {
        ...base,
        type: "ADRESSAGE",
        data: {
          ...emptyAdressage(DATE),
          exams: { conduits: true, bilan: true, autre: true },
          autreText:
            "Suspicion de bouchon de cérumen à droite. Vertiges rotatoires évoluant depuis trois semaines, sans acouphène associé.",
        },
      },
    },
    {
      name: "adressage-limites",
      model: {
        ...base,
        patient: { ...longPatient, civility: "M." },
        prescriber: longPrescriber,
        type: "ADRESSAGE",
        data: {
          ...emptyAdressage("2026-10-01"),
          exams: { conduits: false, bilan: true, autre: true },
          autreText:
            "Baisse d'audition brutale de l'oreille gauche survenue il y a 48 heures, accompagnée d'acouphènes aigus et d'une sensation de plénitude ; pas d'antécédent otologique connu. Un avis rapide serait souhaitable.",
        },
      },
    },
    {
      name: "adressage-minimal",
      model: {
        ...base,
        author: { ...base.author, signature: null, rpps: "" },
        prescriber: { ...lefevre, practiceName: "", salutation: "" },
        type: "ADRESSAGE",
        data: { ...emptyAdressage(DATE), exams: { conduits: true, bilan: false, autre: false } },
      },
    },
    { name: "compte-rendu", model: { ...base, type: "COMPTE_RENDU", audiometry: sampleAudiometry(), data: fullCr } },
    {
      name: "compte-rendu-limites",
      model: {
        ...base,
        patient: longPatient,
        prescriber: longPrescriber,
        type: "COMPTE_RENDU",
        audiometry: sampleAudiometry(),
        data: {
          ...fullCr,
          deviceBrand: "autre",
          deviceBrandOther: "Phonak",
          deviceModel: "Audéo Sphere Infinio 90 – R (écouteur M, dôme ouvert)",
          comments: longComment,
        },
      },
    },
    {
      name: "compte-rendu-sans-bilan",
      model: {
        ...base,
        type: "COMPTE_RENDU",
        audiometry: null,
        data: { ...fullCr, includeAnnex: true, attachmentId: null },
      },
    },
    {
      name: "compte-rendu-une-oreille",
      model: {
        ...base,
        type: "COMPTE_RENDU",
        audiometry: rightEarOnly(),
        data: {
          ...fullCr,
          ears: "droite",
          degree: "severe",
          deviceType: "contour",
          customEarmolds: true,
          comments: "Appareillage unilatéral droit, oreille gauche normo-entendante. Adaptation rapide.",
        },
      },
    },
    {
      name: "compte-rendu-vide",
      model: {
        ...base,
        author: { ...base.author, signature: null, rpps: "" },
        prescriber: { ...lefevre, practiceName: "" },
        type: "COMPTE_RENDU",
        audiometry: null,
        data: { ...emptyCompteRendu(DATE), includeAnnex: false },
      },
    },
  ];
}
