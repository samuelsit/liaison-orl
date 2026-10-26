/**
 * Libellés de la liste des documents, des envois (liste, suivi, récapitulatif d'envoi,
 * envoi groupé). Français, vouvoiement, vrais pluriels (jamais de « (s) »).
 */

const pluralRules = new Intl.PluralRules("fr-FR");
const numberFormat = new Intl.NumberFormat("fr-FR");

/** Accord en nombre selon la règle française (0 et 1 au singulier). */
export function plural(n: number, one: string, other: string): string {
  return pluralRules.select(n) === "one" ? one : other;
}

/** « 1 document », « 1 234 documents ». */
export function countLabel(n: number, one: string, other: string): string {
  return `${numberFormat.format(n)} ${plural(n, one, other)}`;
}

/** Montant en euros (centimes → « 1,44 € »). */
export function formatEuros(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export const dispFr = {
  /* ---------- Liste des documents ---------- */
  documents: {
    newDocument: "Nouveau document",
    newAdressage: "Courrier d'adressage",
    newCompteRendu: "Compte rendu d'appareillage",
    searchPlaceholder: "Rechercher un patient…",
    searchLabel: "Rechercher un document par patient",
    statusLabel: "Filtrer par statut",
    all: "Tous",
    statuses: { BROUILLON: "Brouillons", VALIDE: "Validés", ENVOYE: "Envoyés", ERREUR: "Erreurs" },
    typeGroup: "Type de document",
    scopeGroup: "Affichage",
    mine: "Mes documents",
    allCentres: "Tous mes centres",
    removeFilterPrefix: "Retirer le filtre",
    count: (n: number) => countLabel(n, "document", "documents"),
    shownOf: (shown: number, total: number) =>
      `${numberFormat.format(shown)} sur ${countLabel(total, "document", "documents")}`,
    loadMore: (n: number) => `Afficher ${numberFormat.format(n)} de plus`,
    noPatient: "Brouillon sans patient",
    noPrescriber: "ORL à choisir",
    preparedBy: (name: string) => `Préparé par ${name}`,
    selectValidated: (n: number) => (n === 1 ? "Sélectionner le document validé" : `Sélectionner les ${n} validés`),
    selectValidatedLabel: (n: number) =>
      n === 1 ? "Sélectionner le document validé pour un envoi groupé" : `Sélectionner les ${n} documents validés pour un envoi groupé`,
    selectRow: (name: string) => `Sélectionner ${name}`,
    selectionLabel: "Documents sélectionnés",
    sendSelection: "Envoyer la sélection",
    empty: {
      none: "Aucun document pour l'instant",
      noneHint: "Vos courriers d'adressage et comptes rendus apparaîtront ici dès leur création.",
      filtered: "Aucun document ne correspond",
      filteredHint: (filters: string) => `Filtres actifs : ${filters}.`,
      clearFilters: "Effacer les filtres",
      search: "Effacer la recherche",
    },
  },

  /* ---------- Actions de ligne ---------- */
  rowActions: {
    prepareSend: "Préparer l'envoi",
    track: "Voir le suivi",
    fix: "Corriger l'envoi",
    downloadPdf: "Télécharger le PDF",
    newCompteRenduFor: "Nouveau compte rendu pour ce patient",
    newAdressageFor: "Nouvel adressage pour ce patient",
    deleteDraft: "Supprimer le brouillon",
    deleteTitle: "Supprimer ce brouillon ?",
    deleteDescription: (name: string | null) =>
      `Le brouillon${name ? ` de ${name}` : ""} et ses pièces jointes seront définitivement supprimés. Cette action est irréversible.`,
    deleteConfirm: "Supprimer",
    deleted: "Brouillon supprimé.",
    viewDocument: "Voir le document",
    prescriberCard: "Fiche du prescripteur",
    fixPrescriber: "Corriger la fiche",
    resend: "Renvoyer",
  },

  /** Mini-indicateurs d'envoi sur les documents envoyés. */
  indicators: {
    label: (parts: string[]) => `Envois : ${parts.join(", ")}`,
    part: (channel: string, status: string) => `${channel} ${status.toLowerCase()}`,
  },

  /* ---------- Envoi groupé ---------- */
  bulk: {
    title: "Envoi groupé",
    description:
      "Chaque document part par le canal préféré de son prescripteur (e-mail avec lien sécurisé et/ou courrier), avec les options d'envoi par défaut.",
    checking: "Vérification des destinataires…",
    summary: (n: number) => `${countLabel(n, "document sera envoyé", "documents seront envoyés")}.`,
    skipped: (n: number) => `${countLabel(n, "document sera ignoré", "documents seront ignorés")} faute de canal disponible.`,
    noChannel: "Aucun canal disponible : ce document sera ignoré.",
    noPrescriber: "Prescripteur à renseigner",
    postalTotal: (amount: string) => `Total courrier estimé : ≈ ${amount} TTC`,
    confirm: (n: number) => `Envoyer ${countLabel(n, "document", "documents")}`,
    resultsTitle: "Résultat de l'envoi groupé",
    resultToast: (ok: number, total: number) =>
      ok === total
        ? `${countLabel(total, "document envoyé", "documents envoyés")}.`
        : `${countLabel(ok, "document envoyé", "documents envoyés")} sur ${numberFormat.format(total)}.`,
    track: "Voir le suivi",
  },

  /* ---------- Liste des envois ---------- */
  envois: {
    description: "Suivi des e-mails et des courriers postaux de vos documents.",
    searchPlaceholder: "Rechercher un patient ou un ORL…",
    searchLabel: "Rechercher un envoi par patient ou par prescripteur",
    statusLabel: "Filtrer par état",
    filters: { tous: "Tous", encours: "En cours", erreurs: "Erreurs" },
    channelGroup: "Canal",
    channels: { email: "E-mails", courrier: "Courriers" },
    scopeGroup: "Affichage",
    allCentres: "Tous mes centres",
    count: (n: number) => countLabel(n, "envoi", "envois"),
    shownOf: (shown: number, total: number) =>
      `${numberFormat.format(shown)} sur ${countLabel(total, "envoi", "envois")}`,
    empty: {
      errors: "Aucune erreur d'envoi",
      errorsHint: "Tous vos envois sont partis correctement.",
      filtered: "Aucun envoi pour ces critères",
      filteredHint: "Modifiez la recherche ou les filtres pour élargir la liste.",
      seeAll: "Voir tous les envois",
      none: "Aucun envoi pour l'instant",
      noneHint: "Les documents envoyés par e-mail ou par courrier apparaîtront ici, avec leur suivi.",
    },
  },

  /* ---------- Actualisation automatique ---------- */
  refresh: {
    justNow: "Mis à jour à l'instant",
    updatedAgo: (seconds: number) =>
      seconds < 60 ? `Mis à jour il y a ${seconds} s` : `Mis à jour il y a ${Math.floor(seconds / 60)} min`,
    refresh: "Actualiser",
    auto: "Les statuts en cours sont actualisés automatiquement toutes les 30 secondes.",
    errorToast: (channel: string, recipient: string) => `${channel} à ${recipient} : échec de l'envoi`,
    see: "Voir",
  },

  /* ---------- Fiche de suivi d'un envoi ---------- */
  detail: {
    title: (channel: string, recipient: string) => `${channel} · ${recipient}`,
    description: (type: string, patient: string | null, version: number, date: string) =>
      `${type}${patient ? ` pour ${patient}` : ""} · version ${version} · le ${date}`,
    progress: "Progression",
    details: "Détails",
    journal: (n: number) => `Journal technique (${countLabel(n, "événement", "événements")})`,
    patient: "Patient",
    recipient: "Destinataire",
    email: "E-mail",
    address: "Adresse",
    options: "Options",
    cost: "Coût",
    security: "Sécurité",
    secureLink: "Lien sécurisé à durée limitée",
    attachment: "PDF joint à l'e-mail",
    provider: "Prestataire",
    reference: "Référence",
    providers: { mock: "Simulation (mode démo)", resend: "Resend", pingen: "Pingen" },
    sources: { webhook: "notification du prestataire", poll: "vérification automatique", mock: "simulation", app: "application" },
    resent: "Cet envoi a été suivi d'un renvoi.",
    seeLatest: "Voir le dernier envoi",
    postalPdf: "PDF postal envoyé",
    copyReference: "Copier la référence",
    copyEmail: "Copier l'adresse e-mail",
    copied: "Copié dans le presse-papiers.",
    simulatedEmail: "E-mail simulé (mode démo)",
    simulatedSubject: (subject: string, to: string) => `Objet : ${subject} — envoyé à ${to}`,
  },

  /** Libellés des événements techniques (journal). */
  events: {
    created: "Envoi créé",
    "email.sent": "E-mail accepté par le service d'envoi",
    "email.delivered": "E-mail délivré au serveur du destinataire",
    "email.opened": "E-mail ouvert",
    "email.bounced": "E-mail rejeté",
    "email.failed": "Échec de l'envoi",
    "email.delivery_delayed": "Remise retardée",
    "link.opened": "Document consulté via le lien sécurisé",
    "letter.valid": "Courrier validé par le prestataire",
    "letter.submitted": "Courrier transmis pour impression",
    "letter.printing": "Courrier en impression",
    "letter.sent": "Courrier remis à La Poste",
    webhook_sent: "Courrier remis à La Poste",
    webhook_delivered: "Courrier distribué",
    webhook_undeliverable: "Courrier non distribuable",
    webhook_issues: "Problème signalé par le prestataire",
    cancelled: "Envoi annulé",
    error: "Erreur",
  } as Record<string, string>,

  /** Étapes du suivi (stepper). */
  stepper: {
    label: "Étapes de l'envoi",
    EMAIL: { created: "Créé", sent: "Accepté", delivered: "Délivré", opened: "Consulté" },
    COURRIER: { created: "Créé", sent: "Transmis", printing: "En impression", posted: "Remis à La Poste" },
    waiting: "En attente",
    current: "étape actuelle",
    done: "terminée",
  },

  /* ---------- Confirmations (renvoi, annulation, masquage) ---------- */
  confirm: {
    resendEmailTitle: (recipient: string) => `Renvoyer l'e-mail au ${recipient} ?`,
    resendEmailDescription: (email: string | null) =>
      email ? `Un nouvel e-mail sera envoyé à ${email}.` : "Un nouvel e-mail sera envoyé au prescripteur.",
    resendPostalTitle: "Renvoyer un nouveau courrier ?",
    resendPostalDescription: (address: string | null) =>
      address
        ? `Une nouvelle lettre sera imprimée et postée à l'adresse : ${address}, avec les options d'envoi par défaut.`
        : "Une nouvelle lettre sera imprimée et postée, avec les options d'envoi par défaut.",
    resendPostalCost: (amount: string) => `Coût indicatif (dernier envoi) : ${amount} TTC.`,
    resendEmailAction: "Renvoyer",
    resendPostalAction: "Renvoyer le courrier",
    resent: "Nouvel envoi effectué.",
    cancelTitle: "Annuler ce courrier ?",
    cancelDescription: "Il ne sera ni imprimé ni posté. Cette action est définitive.",
    cancelAction: "Annuler le courrier",
    keep: "Conserver",
    acknowledge: "Masquer l'erreur",
    acknowledged: "Erreur masquée : elle n'apparaît plus dans les erreurs d'envoi.",
  },

  /* ---------- Récapitulatif d'envoi ---------- */
  review: {
    back: "Document",
    title: (typeLower: string) => `Envoyer le ${typeLower}`,
    tabsSend: "Envoi",
    tabsPreview: "Aperçu",
    documentSection: "Document et destinataire",
    documentLine: (type: string, version: number) => `${type} · version ${version}`,
    patient: "Patient",
    recipient: "Destinataire",
    noPrescriber: "Aucun prescripteur : rouvrez le document pour en choisir un.",
    editPrescriber: "Modifier la fiche",
    prefers: (channel: string) => `Préfère : ${channel.toLowerCase()}`,
    channelsSection: "Canaux d'envoi",
    channelsHint: "Cochez un ou deux canaux.",
    emailSubtitle: (to: string, secure: boolean, days: number) => (secure ? `${to} · lien sécurisé ${days} j` : `${to} · PDF joint`),
    postalSubtitle: (price: string | null, pages: number) =>
      `${price ? `≈ ${price} TTC` : "Prix calculé à l'envoi"} · ${countLabel(pages, "page", "pages")}`,
    addEmail: "Ajouter l'e-mail",
    completeAddress: "Compléter l'adresse",
    postalIncomplete: "Adresse postale incomplète.",
    alreadySent: "Déjà envoyé",
    alreadySentTitle: "Ce document a déjà été envoyé",
    alreadySentLine: (channel: string, date: string, status: string) => `${channel} le ${date} (${status})`,
    alreadySentHint:
      "Pour renvoyer cette version, utilisez « Renvoyer » sur la page de suivi : un nouvel envoi y est créé après confirmation.",
    track: "Voir le suivi",
    noChannel: "Choisissez au moins un canal",
    nothingAvailable: "Ni e-mail ni adresse postale exploitable : complétez la fiche du prescripteur.",
    emailSection: "E-mail",
    secureBadge: (factor: string, days: number) => `Lien sécurisé · ${factor} · ${days} j`,
    factorBirthdate: "date de naissance",
    factorCode: "code séparé",
    attachmentBadge: "PDF joint en clair",
    to: "À",
    subject: "Objet",
    replies: "Réponses",
    showMessage: "Voir le message",
    hideMessage: "Masquer le message",
    copyCentre: (email: string) => `Mettre le centre en copie (${email})`,
    postalSection: "Courrier postal",
    windowCaption: "Zone fenêtre de l'enveloppe",
    printedAddress: "Adresse imprimée",
    delivery: "Affranchissement",
    deliveryHints: { cheap: "Le plus économique", fast: "Distribution accélérée", registered: "Avec suivi et preuve de dépôt" },
    printing: "Impression",
    color: "Couleur",
    grayscale: "Noir et blanc",
    sides: "Faces",
    simplex: "Recto",
    duplex: "Recto-verso",
    pagesLine: (pages: number) => `${countLabel(pages, "page", "pages")} (page d'accompagnement incluse)`,
    priceUnavailable: "prix indisponible",
    computing: "Calcul du prix…",
    summaryEmail: "E-mail sécurisé",
    summaryEmailAttachment: "E-mail avec PDF joint",
    summaryPostal: "Courrier",
    summaryBoth: "E-mail + courrier",
    send: { EMAIL: "Envoyer par e-mail", COURRIER: "Envoyer par courrier", both: "Envoyer par e-mail et courrier" },
    sending: "Envoi en cours…",
    sentToast: {
      both: "Document envoyé par e-mail et par courrier.",
      EMAIL: "Document envoyé par e-mail.",
      COURRIER: "Document envoyé par courrier.",
    },
    failedToast: "Un envoi a échoué",
    history: (n: number) => `Envois précédents de ce document (${numberFormat.format(n)})`,
    prescriberUpdated: "Fiche du prescripteur mise à jour.",
  },

  /* ---------- Panneau de succès ---------- */
  success: {
    title: "Envoi effectué",
    description: "Les statuts se mettent à jour ici pendant quelques minutes, puis dans le suivi des envois.",
    emailTo: (to: string) => `E-mail à ${to}`,
    email: "E-mail",
    postal: "Courrier postal",
    postalCost: (amount: string) => `Courrier postal · ${amount}`,
    track: "Voir le suivi",
    retry: "Réessayer",
    next: (patient: string) => `Envoyer le document suivant — ${patient}`,
    nextHint: "Un autre document validé de votre centre attend son envoi.",
    then: "Et ensuite ?",
    newAdressage: "Nouvel adressage",
    newCompteRendu: "Nouveau compte rendu",
    home: "Retour à l'accueil",
    allDispatches: "Tous les envois",
  },
} as const;
