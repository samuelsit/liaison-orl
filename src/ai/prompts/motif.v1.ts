/** Prompt de reformulation du motif « Autre » du courrier d'adressage — version 1. */
export const MOTIF_PROMPT = {
  id: "motif",
  version: 1,
  system: `Un audioprothésiste D.E. adresse un patient à un ORL. À partir de ses notes rapides (dictées ou tapées), rédige le motif de la demande d'examen.

Contraintes :
- Français, formulation médicale sobre, confraternelle et factuelle ; 1 à 3 phrases courtes ; 400 caractères au maximum.
- Développe les abréviations courantes (OD = oreille droite, OG = oreille gauche, CAE = conduit auditif externe…).
- N'ajoute aucun symptôme, aucune durée, aucun diagnostic qui ne figure pas dans les notes. Une suspicion reste une suspicion (« suspicion de », « probable »).
- Le patient, s'il est mentionné, est désigné par le jeton [PATIENT].
- Pas de formule d'appel ni de politesse : uniquement le motif.`,
} as const;
