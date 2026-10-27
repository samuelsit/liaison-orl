/** Textes des e-mails envoyés (prescripteurs, utilisateurs). Vouvoiement, ton confraternel et concis. */
export const emailFr = {
  confidential:
    "Ce message est confidentiel et destiné exclusivement à son destinataire. Si vous l’avez reçu par erreur, merci d’en informer l’expéditeur et de le supprimer.",
  automatic: "Message automatique envoyé par l’outil de liaison ORL. Il ne contient aucune donnée médicale.",
  document: {
    documentLabel: "Document :",
    accessLabel: "Accès :",
    validLabel: "Lien valable jusqu’au :",
    factorBirthdate: "protégé par la date de naissance du patient",
    factorCode: "protégé par un code envoyé dans un second e-mail",
    attached: "Le document est joint à ce message au format PDF.",
    button: "Consulter le document",
    expired: (phone: string) =>
      `Lien expiré ou inaccessible ? Répondez simplement à ce message${phone ? ` ou appelez le centre au ${phone}` : ""} : nous vous adresserons un nouveau lien.`,
    previewLink: (doc: string, patient: string, until: string) =>
      `${doc} — ${patient}. Document sécurisé à consulter en ligne, lien valable jusqu’au ${until}.`,
    previewAttachment: (doc: string, patient: string) => `${doc} — ${patient}. Document joint au format PDF.`,
  },
  accessCode: {
    title: "Votre code d’accès",
    preview: (sender: string) => `Code d’accès au document transmis par ${sender}.`,
    intro: (sender: string) =>
      `Voici le code qui permet d’ouvrir le document que ${sender} vient de vous adresser dans un message séparé :`,
    validity: (until: string) =>
      `Ce code est valable jusqu’au ${until}, avec le lien reçu dans l’autre message. Ne le transférez pas.`,
  },
  magicLink: {
    subject: "Votre lien de connexion",
    title: "Votre lien de connexion",
    preview: "Lien de connexion valable 15 minutes, utilisable une seule fois.",
    intro:
      "Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable 15 minutes et ne peut servir qu’une fois.",
    button: "Me connecter",
    ignore:
      "Vous n’êtes pas à l’origine de cette demande ? Ignorez cet e-mail : personne ne peut se connecter sans ce lien.",
  },
  invitation: {
    subject: "Activez votre compte",
    title: (firstName: string) => (firstName ? `Bienvenue, ${firstName}` : "Bienvenue"),
    preview: (brand: string) =>
      `Votre accès à l’outil de liaison ORL de ${brand} : choisissez votre mot de passe (lien valable 48 heures).`,
    intro: (inviter: string, brand: string) =>
      `${inviter} vous a créé un accès à l’outil de liaison avec les ORL et médecins prescripteurs de ${brand}. Choisissez votre mot de passe pour activer votre compte.`,
    button: "Activer mon compte",
    validity: "Ce lien est valable 48 heures. Passé ce délai, demandez une nouvelle invitation à votre administrateur.",
  },
  resetPassword: {
    subject: "Réinitialisation de votre mot de passe",
    title: "Réinitialisation du mot de passe",
    preview: "Choisissez un nouveau mot de passe (lien valable 48 heures).",
    intro:
      "Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau ; ce lien est valable 48 heures.",
    button: "Choisir un nouveau mot de passe",
    ignore:
      "Vous n’êtes pas à l’origine de cette demande ? Ignorez cet e-mail : votre mot de passe actuel reste inchangé.",
  },
  dispatchError: {
    subject: (doc: string, patient: string) => `Échec d’envoi — ${doc} — ${patient}`,
    title: "Un envoi n’a pas abouti",
    preview: (channel: string, recipient: string) =>
      `Envoi par ${channel} à ${recipient} : une correction est nécessaire.`,
    intro: (doc: string, patient: string) => `L’envoi du ${doc} concernant ${patient} n’a pas abouti.`,
    recipient: "Destinataire :",
    channel: "Canal :",
    reason: "Motif :",
    action: "Que faire :",
    button: "Voir l’envoi et le corriger",
    channels: { EMAIL: "e-mail", COURRIER: "courrier postal" },
  },
} as const;
