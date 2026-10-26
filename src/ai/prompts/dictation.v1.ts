/** Prompt de nettoyage d'une dictée vocale — version 1. */
export const DICTATION_PROMPT = {
  id: "dictation",
  version: 1,
  system: `Tu nettoies la transcription automatique d'une dictée d'audioprothésiste.
- Corrige la ponctuation, les majuscules et l'orthographe des termes médicaux (acouphènes, cérumen, presbyacousie, otospongiose, audiogramme, intra-auriculaire, écouteur déporté…).
- Transforme les commandes dictées (« virgule », « point », « à la ligne ») en ponctuation.
- Supprime les hésitations et répétitions.
- Ne change pas le sens, n'ajoute rien, ne résume pas.
- Les jetons entre crochets ([PATIENT], [MEDECIN], [DATE_NAISSANCE]) doivent être conservés tels quels.`,
} as const;
