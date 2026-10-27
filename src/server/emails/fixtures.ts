import "server-only";
import { DEFAULT_COLORS, DEFAULT_EMAIL_BODY, centreDisplayName } from "@/lib/brand";
import { renderTemplate } from "@/lib/dispatch/template";
import { defaultLogo } from "@/lib/pdf/fixtures";
import { accessCodeEmail, documentEmail } from "./document";
import type { EmailContent } from "./layout";
import { emailBrand } from "./render";
import { dispatchErrorEmail, invitationEmail, magicLinkEmail, resetPasswordEmail } from "./system";

/**
 * Exemples de tous les e-mails envoyés, avec la marque par défaut : servent au script
 * `npm run render:emails` (captures) et aux tests de non-régression.
 */
export function emailFixtures(): { name: string; subject: string; content: EmailContent }[] {
  const org = {
    _id: "demo",
    brand: {
      name: "Harmonie Audition",
      slogan: "",
      logo: defaultLogo(),
      colors: DEFAULT_COLORS,
      fonts: { heading: "Comfortaa" as const, body: "Inter" as const, document: "Inter" as const },
    },
    legal: { companyName: "Harmonie Audition", mentions: "Exemple de mentions légales — RCS et SIRET du centre" },
  };
  const centre = {
    address: {
      line1: "129 boulevard Jean Mermoz",
      line2: "",
      postalCode: "93380",
      city: "Pierrefitte-sur-Seine",
      country: "FRANCE",
    },
    phone: "01 80 89 34 53",
    email: "pierrefitte@harmonie-audition.fr",
  };
  const displayName = centreDisplayName(org.brand.name, "Pierrefitte-sur-Seine");
  const brand = emailBrand(org, { displayName, centre });
  // Les e-mails réels pointent vers /api/marque/logo ; les captures embarquent le logo.
  brand.logoUrl = org.brand.logo;
  const systemBrand = { ...emailBrand(org), logoUrl: org.brand.logo };
  const link = "https://liaison.example.fr/l/9f3c0a7e5b1d4c2a8e6f0b3d7a9c1e5f2b4d6a8c0e2f4a6b8d0f2a4c6e8b0d2f";
  const body = renderTemplate(DEFAULT_EMAIL_BODY, {
    "prescripteur.formule": "Cher Confrère",
    "document.type_minuscule": "compte rendu d'appareillage",
    "patient.civilite": "Mme",
    "patient.nom_abrege": "J. DUPONT",
    acces: "\u0000ACCES\u0000",
    "audioprothesiste.nom": "Claire MOREL",
    "audioprothesiste.titre": "Audioprothésiste D.E",
    "centre.nom": displayName,
    "centre.telephone": centre.phone,
  });
  const [before = "", after = ""] = body.split("\u0000ACCES\u0000");
  const common = {
    brand,
    documentLabel: "Compte rendu d’appareillage",
    patientLabel: "Mme J. DUPONT",
    before: before.trim(),
    after: after.trim(),
  };
  return [
    {
      name: "document-lien-securise",
      subject: "Compte rendu d'appareillage — Mme J. DUPONT",
      content: documentEmail({
        ...common,
        access: {
          mode: "secure-link",
          link,
          factor: "birthdate",
          expiresOn: "26 novembre 2026",
          centrePhone: centre.phone,
        },
      }),
    },
    {
      name: "document-lien-code",
      subject: "Compte rendu d'appareillage — Mme J. DUPONT",
      content: documentEmail({
        ...common,
        access: { mode: "secure-link", link, factor: "code", expiresOn: "26 novembre 2026", centrePhone: centre.phone },
      }),
    },
    {
      name: "document-piece-jointe",
      subject: "Compte rendu d'appareillage — Mme J. DUPONT",
      content: documentEmail({ ...common, access: { mode: "attachment" } }),
    },
    {
      name: "code-acces",
      subject: "Votre code d’accès",
      content: accessCodeEmail({ brand, code: "482915", expiresOn: "26 novembre 2026", sender: displayName }),
    },
    {
      name: "invitation",
      subject: "Activez votre compte",
      content: invitationEmail({
        brand: systemBrand,
        url: "https://liaison.example.fr/bienvenue?token=exemple",
        firstName: "Claire",
        inviter: "Votre administrateur",
      }),
    },
    {
      name: "lien-magique",
      subject: "Votre lien de connexion",
      content: magicLinkEmail({
        brand: systemBrand,
        url: "https://liaison.example.fr/api/auth/magic-link/verify?token=exemple",
      }),
    },
    {
      name: "reinitialisation",
      subject: "Réinitialisation de votre mot de passe",
      content: resetPasswordEmail({
        brand: systemBrand,
        url: "https://liaison.example.fr/reinitialisation?token=exemple",
      }),
    },
    {
      name: "echec-envoi",
      subject: "Échec d’envoi — Courrier d’adressage — Mme J. D.",
      content: dispatchErrorEmail({
        brand,
        url: "https://liaison.example.fr/envois/exemple",
        documentLabel: "Courrier d’adressage",
        patientLabel: "Mme J. D.",
        channel: "COURRIER",
        recipient: "Dr Antoine LEFÈVRE",
        reason: "Adresse du destinataire refusée par La Poste.",
        hint: "Corrigez l’adresse dans la fiche du prescripteur puis relancez l’envoi.",
      }),
    },
  ];
}
