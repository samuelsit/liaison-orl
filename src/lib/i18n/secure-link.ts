/** Page de consultation du lien sécurisé (côté médecin). */
export const secureLinkFr = {
  confidentialBadge: "Document médical confidentiel",
  confidentialFooter:
    "Document médical confidentiel, destiné exclusivement au médecin destinataire. Chaque consultation est enregistrée.",
  expiredTitle: "Ce lien n’est plus actif",
  expiredText:
    "Pour des raisons de confidentialité, les liens d’accès aux documents ont une durée limitée. Répondez à l’e-mail reçu ou contactez le centre auditif : un nouveau lien vous sera adressé.",
  lockedTitle: "Document médical sécurisé",
  sentBy: (centre: string) => `Document transmis par ${centre}. `,
  askBirthdate: "Pour l’ouvrir, saisissez la date de naissance du patient concerné.",
  askCode: "Pour l’ouvrir, saisissez le code à 6 chiffres reçu dans un second e-mail.",
  validity: (until: string) =>
    `Lien valable jusqu’au ${until}. Après 5 essais erronés, l’accès est suspendu 15 minutes.`,
  contact: (centre: string) => `Une question ? ${centre} :`,
  documentFallback: "Document",
  sentOn: (date: string) => `envoyé le ${date}`,
  open: "Ouvrir le PDF",
  download: "Télécharger",
  previewLabel: "Aperçu du document",
  previewError: "L’aperçu n’a pas pu s’afficher. Utilisez « Ouvrir le PDF » ou « Télécharger ».",
  logged: "Votre accès reste ouvert 15 minutes sur cet appareil.",
} as const;
