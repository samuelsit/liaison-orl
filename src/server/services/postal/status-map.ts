import type { DispatchStatus } from "@/lib/schemas/dispatch";

/**
 * Correspondance des statuts Pingen (liste non exhaustive publiée par Pingen) vers les
 * statuts de l'application. Un statut inconnu est traité comme « en cours ».
 */
export function mapPingenStatus(status: string): DispatchStatus {
  switch (status) {
    case "validating":
    case "processing":
      return "queued";
    case "valid":
      return "awaiting_confirmation";
    case "action_required":
      return "action_required";
    case "invalid":
    case "unprintable":
    case "rejected":
      return "failed";
    case "submitted":
    case "accepted":
    case "awaiting_credits":
    case "transferring":
    case "inspection":
    case "fixing":
      return "sent";
    case "printing":
      return "printing";
    case "sent":
    case "delivered":
      return "posted";
    case "undeliverable":
      return "undeliverable";
    case "cancelled":
    case "cancelling":
    case "cancelled_expired":
    case "expired":
      return "cancelled";
    default:
      return "queued";
  }
}

/** Explication lisible et action de correction pour un problème signalé par le prestataire. */
export function explainPostalIssue(reason: string | null): { message: string; hint: string } {
  const r = (reason ?? "").toLowerCase();
  if (/address|adress|postcode|zip|city|ville/.test(r)) {
    return {
      message: "L'adresse du destinataire a été refusée par le service postal.",
      hint: "Corrigez l'adresse du prescripteur (code postal à 5 chiffres, ville, pays) dans l'annuaire, puis renvoyez le courrier.",
    };
  }
  if (/restricted|area|zone|marg/.test(r)) {
    return { message: "Le PDF déborde sur une zone réservée à l'imprimeur.", hint: "Renvoyez le courrier : le document est régénéré avec les marges postales. Si le problème persiste, contactez le support." };
  }
  if (/credit|crédit|balance/.test(r)) {
    return { message: "Crédit insuffisant sur le compte du prestataire postal.", hint: "Rechargez le compte Pingen ; l'envoi reprendra automatiquement." };
  }
  if (/format|paper|interactive|pdf/.test(r)) {
    return { message: "Le fichier PDF n'est pas conforme aux exigences d'impression.", hint: "Renvoyez le courrier ; si l'erreur persiste, contactez le support technique." };
  }
  if (/undeliverable|moved|deceased|non distribu/.test(r)) {
    return { message: "Le courrier n'a pas pu être distribué.", hint: "Vérifiez l'adresse du prescripteur ou préférez l'envoi par e-mail." };
  }
  return { message: reason ? `Problème signalé par le prestataire : ${reason}` : "Le prestataire postal signale un problème.", hint: "Consultez le détail de l'envoi puis renvoyez après correction." };
}
