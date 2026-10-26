/**
 * npm run pdf:samples [dossier] — génère des PDF d'exemple (modèles vierges, remplis, version postale)
 * pour contrôler visuellement la fidélité aux modèles de docs/modeles/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_COLORS } from "@/lib/brand";
import { emptyAdressage, emptyCompteRendu } from "@/lib/documents/defaults";
import { emptyAudiometry } from "@/lib/schemas/audiometry";
import type { PdfModel } from "@/lib/pdf/model";
import { renderPdf } from "@/lib/pdf/render";

const out = path.resolve(process.argv[2] ?? ".data/pdf-samples");
mkdirSync(out, { recursive: true });

const logo = `data:image/png;base64,${readFileSync(path.resolve("assets/brand/logo-default.png")).toString("base64")}`;
const common = {
  brand: { name: "Harmonie Audition", slogan: "BIEN ENTENDRE, MIEUX VIVRE", logo, colors: DEFAULT_COLORS, font: "Comfortaa" as const },
  centre: {
    name: "Pierrefitte-sur-Seine",
    displayName: "Harmonie Audition — Pierrefitte-sur-Seine",
    address: { line1: "129 boulevard Jean Mermoz", line2: "", postalCode: "93380", city: "Pierrefitte-sur-Seine", country: "FRANCE" },
    phone: "01 80 89 34 53",
    email: "pierrefitte@demo.test",
    senderAddress: null,
  },
  author: { firstName: "", lastName: "", title: "Audioprothésiste D.E", signature: null },
  patient: null,
  prescriber: null,
  showSignature: true,
  defaultSalutation: "Cher(e) Docteur",
  draft: false,
};

const filledPeople = {
  author: { firstName: "Claire", lastName: "Morel", title: "Audioprothésiste D.E", signature: null },
  patient: { civility: "Mme", firstName: "Jeanne", lastName: "Durand", birthDate: "1946-03-12" },
  prescriber: {
    civility: "Dr",
    firstName: "Antoine",
    lastName: "Lefèvre",
    salutation: "Cher Confrère",
    practiceName: "Cabinet ORL de la Basilique",
    address: { line1: "5 rue Gabriel Péri", line2: "", postalCode: "93200", city: "Saint-Denis", country: "FRANCE" },
  },
};

const audiometry = emptyAudiometry();
const set = (target: Record<string, unknown>, values: Record<string, number>) => {
  for (const [k, v] of Object.entries(values)) target[k] = { value: v, confidence: "high" };
};
set(audiometry.right.air, { "125": 20, "250": 25, "500": 35, "1000": 45, "2000": 55, "3000": 60, "4000": 65, "6000": 70, "8000": 75 });
set(audiometry.right.bone, { "250": 20, "500": 30, "1000": 40, "2000": 50, "4000": 60 });
set(audiometry.left.air, { "125": 15, "250": 20, "500": 30, "1000": 40, "2000": 50, "3000": 60, "4000": 70, "6000": 75, "8000": 80 });
set(audiometry.left.bone, { "250": 15, "500": 25, "1000": 35, "2000": 45, "4000": 60 });
set(audiometry.freeField.unaided, { "250": 30, "500": 40, "1000": 45, "2000": 55, "4000": 65 });
set(audiometry.freeField.aided, { "250": 25, "500": 25, "1000": 25, "2000": 30, "4000": 40 });
audiometry.freeField.speechUnaided = { srt: { value: 55, confidence: "high" }, maxScore: { value: 60, confidence: "high" }, maxScoreLevel: { value: 70, confidence: "high" } };
audiometry.freeField.speechAided = { srt: { value: 35, confidence: "high" }, maxScore: { value: 90, confidence: "high" }, maxScoreLevel: { value: 60, confidence: "high" } };

const samples: [string, PdfModel, "standard" | "postal"][] = [
  ["adressage-vierge", { ...common, type: "ADRESSAGE", data: { ...emptyAdressage("2026-10-17"), date: "2026-10-17" } }, "standard"],
  ["cr-vierge", { ...common, type: "COMPTE_RENDU", data: { ...emptyCompteRendu("2026-10-17"), reportDate: "", includeAnnex: false }, audiometry: null }, "standard"],
  [
    "adressage-rempli",
    {
      ...common,
      ...filledPeople,
      type: "ADRESSAGE",
      data: {
        ...emptyAdressage("2026-10-17"),
        exams: { conduits: true, bilan: false, autre: true },
        autreText: "Suspicion de bouchon de cérumen à droite. Vertiges rotatoires évoluant depuis trois semaines, sans acouphène associé. Merci de votre avis.",
      },
    },
    "standard",
  ],
  [
    "cr-rempli",
    {
      ...common,
      ...filledPeople,
      type: "COMPTE_RENDU",
      audiometry,
      data: {
        ...emptyCompteRendu("2026-10-17"),
        prescriptionDate: "2026-09-02",
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
        comments:
          "Appareillage stéréophonique bien toléré. Gain tonal moyen de 24 dB, avec une amélioration du seuil d'intelligibilité de 20 dB et un gain de 30 points en intelligibilité maximale. Port quotidien régulier (11 h/jour). Manipulation acquise. Contrôle prévu à 1 mois puis tous les 6 mois.",
      },
    },
    "standard",
  ],
];
samples.push(["adressage-postal", samples[2]![1], "postal"], ["cr-postal", samples[3]![1], "postal"]);

for (const [name, model, variant] of samples) {
  const { buffer, info } = await renderPdf(model, variant);
  writeFileSync(path.join(out, `${name}.pdf`), buffer);
  console.log(`${name}.pdf — ${info.pages} page(s)`);
}
