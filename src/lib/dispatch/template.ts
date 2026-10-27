/** Modèles d'e-mail : variables {{nom.variable}} remplacées, variables inconnues effacées. */
export const TEMPLATE_VARIABLES = [
  ["document.type", "Type de document (« Compte rendu d'appareillage »)"],
  ["document.type_minuscule", "Type de document en minuscules"],
  ["document.date", "Date du document"],
  ["patient.civilite", "Mme / M."],
  ["patient.nom", "Nom du patient"],
  ["patient.prenom", "Prénom du patient"],
  ["patient.initiales", "Initiales du patient (« J. D. »)"],
  ["patient.nom_abrege", "Initiale du prénom et nom (« J. DUPONT », utilisé dans l'objet par défaut)"],
  ["prescripteur.formule", "Formule d'appel (« Cher Confrère »)"],
  ["prescripteur.nom", "Nom du prescripteur"],
  ["centre.nom", "Nom du centre"],
  ["centre.telephone", "Téléphone du centre"],
  ["centre.email", "E-mail du centre"],
  ["audioprothesiste.nom", "Nom de l'audioprothésiste"],
  ["audioprothesiste.titre", "Titre de l'audioprothésiste"],
  ["acces", "Paragraphe d'accès au document (lien sécurisé ou pièce jointe)"],
  ["validite", "Durée de validité du lien"],
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number][0], string>>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (_, key: string) => (vars as Record<string, string | undefined>)[key] ?? "")
    .replace(/(?<!\.)\.\.(?!\.)/g, ".")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Nettoie un objet d'e-mail (une seule ligne, longueur bornée). */
export function renderSubject(template: string, vars: TemplateVars): string {
  return renderTemplate(template, vars).replace(/\s+/g, " ").slice(0, 200);
}

export const ACCESS_MARKER = "\u0000ACCES\u0000";
