/** Textes des documents envoyés aux prescripteurs (PDF). */

const born = (civility: string) => (civility === "M." ? "né" : civility === "Mme" ? "née" : "né(e)");

export const pdfFr = {
  titles: {
    ADRESSAGE: "Courrier d’adressage",
    COMPTE_RENDU: "Compte rendu d’appareillage",
  },
  draft: "BROUILLON",
  objectLabel: "Objet :",
  attention: "À l’attention de",
  place: (city: string, date: string) => (city ? `${city}, le ${date}` : `Le ${date}`),
  phone: (v: string) => `Tél. ${v}`,
  confidential: "Document médical confidentiel — destiné exclusivement au médecin destinataire",
  pagination: (page: number, total: number) => `${page}/${total}`,
  continuation: (patient: string, page: number, total: number) =>
    patient ? `Patient : ${patient} — page ${page}/${total}` : `Page ${page}/${total}`,
  born,
  subject: (type: "ADRESSAGE" | "COMPTE_RENDU", patient: string, civility: string, birthDate: string) =>
    [pdfFr.titles[type], patient ? `${patient}${birthDate ? `, ${born(civility)}\u00a0le\u00a0${birthDate}` : ""}` : ""]
      .filter(Boolean)
      .join(" — "),
  closing: (salutation: string) =>
    `Je reste à votre disposition pour tout complément d’information et vous prie d’agréer, ${salutation}, l’expression de mes salutations distinguées.`,
  rpps: (v: string) => `RPPS ${v}`,
  adressage: {
    intro: (patient: string, civility: string, birthDate: string, exams: number) => {
      const who = patient ? `${patient}${birthDate ? `, ${born(civility)} le ${birthDate},` : ""}` : "votre patient(e)";
      if (exams === 0) return `Je vous adresse ${who} pour avis.`;
      return `Je vous adresse ${who} pour ${exams > 1 ? "les examens suivants" : "l’examen suivant"} :`;
    },
    conduits: "Vérification des conduits auditifs externes",
    bilan: "Bilan auditif",
  },
  compteRendu: {
    intro: (patient: string, prescriptionDate: string) =>
      prescriptionDate
        ? `Suite à votre prescription du ${prescriptionDate}, je vous adresse le compte rendu de l’appareillage auditif de ${patient || "votre patient(e)"}.`
        : `Je vous adresse le compte rendu de l’appareillage auditif de ${patient || "votre patient(e)"}.`,
    identity: {
      lastName: "Nom",
      firstName: "Prénom",
      birthDate: "Date de naissance",
      prescriptionDate: "Date d’ordonnance",
      prescriber: "Prescripteur",
    },
    sections: {
      audiology: "Bilan audiologique",
      gain: "Gain prothétique",
      equipment: "Équipement",
      followUp: "Suivi",
      comments: "Commentaire",
    },
    audiology: {
      degree: "Degré de surdité",
      ears: "Oreille(s) appareillée(s)",
      pta: "Perte moyenne (BIAP)",
      earsValues: { droite: "Oreille droite", gauche: "Oreille gauche", deux: "Les deux oreilles" },
      degreeValues: { legere: "Légère", moyenne: "Moyenne", severe: "Sévère", profonde: "Profonde" },
    },
    audiogram: {
      title: "Audiogramme tonal",
      axisDb: "dB HL",
      axisHz: "Hz",
      legend: {
        rightAir: "Oreille droite — CA",
        leftAir: "Oreille gauche — CA",
        rightBone: "Oreille droite — CO",
        leftBone: "Oreille gauche — CO",
        unaided: "Champ libre sans appareil",
        aided: "Champ libre avec appareils",
      },
      abbreviations: "CA : conduction aérienne · CO : conduction osseuse",
      noResponse: "↓ : absence de réponse",
    },
    gainTable: {
      frequency: "Fréquence (Hz)",
      unaided: "Sans appareil (dB HL)",
      aided: "Avec appareils (dB HL)",
      gain: "Gain (dB)",
      mean: "Moyenne",
      meanNote: (freqs: string) => `Moyenne calculée sur ${freqs} Hz.`,
      speech: "Gain en intelligibilité",
      srt: "Seuil d’intelligibilité",
      maxScore: "Intelligibilité maximale",
      noise: (name: string | null) => (name ? `Dans le bruit (${name})` : "Dans le bruit"),
    },
    equipment: {
      type: "Type d’appareil",
      brand: "Marque",
      model: "Modèle",
      class: "Classe",
      rechargeable: "Rechargeable",
      earmolds: "Embouts sur mesure",
      price: "Prix par appareil",
      typeValues: { intra: "Intra-auriculaire", ecouteur_deporte: "Écouteur déporté", contour: "Contour classique" },
      brandValues: { signia: "Signia", starkey: "Starkey", resound: "GN ReSound", autre: "Autre" },
      classValues: { cmu: "CMU", "1": "Classe 1", "2": "Classe 2" },
      yes: "Oui",
      no: "Non",
    },
    followUp: {
      duration: "Durée de port",
      hours: "Port quotidien moyen",
      hoursValue: (h: string) => `${h} h/jour`,
      motivation: "Motivation",
      handling: "Manipulation des appareils",
      motivationValues: { peu: "Peu motivé(e)", moderee: "Motivation modérée", active: "Participation active" },
      handlingValues: { oui: "Acquise", non: "Non acquise", a_travailler: "À travailler" },
    },
  },
  debug: {
    edge: "Bord bloqué 5 mm",
    postage: "Zone d’affranchissement",
    address: "Zone d’adresse",
    dmc: "DMC",
  },
} as const;
