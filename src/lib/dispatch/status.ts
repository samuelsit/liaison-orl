import { ERROR_STATUSES, type DispatchStatus } from "@/lib/schemas/dispatch";

const RANK: Record<DispatchStatus, number> = {
  queued: 0,
  awaiting_confirmation: 1,
  action_required: 1,
  sent: 2,
  printing: 3,
  delivered: 4,
  posted: 5,
  opened: 6,
  bounced: 7,
  undeliverable: 7,
  failed: 7,
  cancelled: 8,
};

/**
 * Règle de transition : un statut ne peut qu'avancer. Les erreurs sont toujours
 * acceptées (sauf après annulation) ; « action requise » peut revenir à un statut normal
 * une fois le problème corrigé ; un e-mail rejeté ne redevient pas « délivré ».
 */
export function nextStatusAllowed(current: DispatchStatus, next: DispatchStatus): boolean {
  if (current === next) return false;
  if (current === "cancelled") return false;
  if (current === "failed" && next === "queued") return true;
  if ((ERROR_STATUSES as readonly string[]).includes(next)) return current !== "opened" || next !== "bounced";
  if (current === "action_required") return true;
  if (current === "bounced" || current === "undeliverable" || current === "failed") return false;
  return RANK[next] > RANK[current];
}
