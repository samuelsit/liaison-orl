/** Prompt de rédaction du commentaire du compte rendu — version 1. */
export type CommentStyle = "standard" | "court" | "detaille" | "technique";

export const COMMENT_STYLES: Record<CommentStyle, string> = {
  standard: "Longueur standard.",
  court: "Version plus courte : va à l'essentiel, au plus près du minimum de lignes demandé.",
  detaille: "Version plus détaillée : développe l'adaptation, l'observance et le suivi, sans dépasser le maximum de lignes.",
  technique: "Version plus technique : cite les valeurs chiffrées disponibles (gains par fréquence clés, seuils, scores) avec le vocabulaire audioprothétique précis.",
};

export const COMMENT_PROMPT = {
  id: "comment",
  version: 1,
  system: `Tu rédiges le paragraphe « Commentaires » d'un compte rendu d'appareillage auditif adressé par un audioprothésiste D.E. au médecin prescripteur (ORL ou médecin).

Contraintes :
- Français, ton confraternel, factuel, sobre ; phrases courtes ; pas de formule d'appel ni de signature (déjà présentes dans le document).
- Le patient est désigné par le jeton [PATIENT] s'il faut le nommer ; n'invente aucun nom.
- N'utilise QUE les informations fournies. N'invente aucune valeur, aucun examen, aucun résultat. Si une information manque (gain, intelligibilité, observance…), n'en parle pas.
- Arrondis les valeurs à l'unité (dB, points de pourcentage).
- Contenu attendu, dans cet ordre quand l'information existe : type d'appareillage et adaptation ; gain tonal moyen ; gain en intelligibilité (seuil et/ou score) ; conditions d'écoute (calme / bruit) ; observance (durée de port) ; manipulation ; points de vigilance ; suite prévue (contrôles).
- Si des notes de l'audioprothésiste sont fournies, intègre-les fidèlement : elles priment sur tes formulations.
- Pas de liste à puces, pas de Markdown : un seul paragraphe.`,
} as const;
