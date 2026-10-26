import { ERROR_STATUSES, type Channel, type DispatchStatus } from "@/lib/schemas/dispatch";

/*
 * Étapes de suivi d'un envoi (stepper de la fiche d'envoi). Fonctions pures, testées :
 * aucune règle métier nouvelle, on ne fait que lire le statut et les événements reçus.
 */

export const EMAIL_STEPS = ["created", "sent", "delivered", "opened"] as const;
export const POSTAL_STEPS = ["created", "sent", "printing", "posted"] as const;

export type EmailStepKey = (typeof EMAIL_STEPS)[number];
export type PostalStepKey = (typeof POSTAL_STEPS)[number];
export type StepKey = EmailStepKey | PostalStepKey;

/** done : franchie · current : état actuel · upcoming : à venir · error / cancelled : interruption. */
export type StepState = "done" | "current" | "upcoming" | "error" | "cancelled";

export interface DispatchStep {
  key: StepKey;
  state: StepState;
  /** Horodatage ISO de la première fois où l'étape a été atteinte (ou de l'interruption). */
  at: string | null;
  /** Statut d'interruption affiché à la place du libellé de l'étape (erreur, annulation). */
  status: DispatchStatus | null;
}

export interface DispatchStepsInput {
  channel: Channel;
  status: DispatchStatus;
  createdAt: Date | string;
  sentAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  openedAt?: Date | string | null;
  events: { status?: DispatchStatus; at: Date | string }[];
}

const iso = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Rang d'un statut « positif » dans le parcours du canal (-1 si erreur ou annulation). */
export function stepIndex(channel: Channel, status: DispatchStatus): number {
  switch (status) {
    case "queued":
    case "awaiting_confirmation":
      return 0;
    case "sent":
      return 1;
    case "delivered":
      return channel === "EMAIL" ? 2 : 1;
    case "opened":
      return channel === "EMAIL" ? 3 : 1;
    case "printing":
      return channel === "COURRIER" ? 2 : 1;
    case "posted":
      return channel === "COURRIER" ? 3 : 1;
    default:
      return -1;
  }
}

export const isErrorStatus = (status: DispatchStatus) => (ERROR_STATUSES as readonly DispatchStatus[]).includes(status);

/** Calcule l'état de chaque étape d'un envoi à partir de son statut et de ses événements. */
export function dispatchSteps(input: DispatchStepsInput): DispatchStep[] {
  const keys: readonly StepKey[] = input.channel === "EMAIL" ? EMAIL_STEPS : POSTAL_STEPS;
  const last = keys.length - 1;
  const interrupted = isErrorStatus(input.status) || input.status === "cancelled";

  // Étape la plus avancée atteinte : statut courant, ou meilleur statut positif des événements.
  let reached = Math.max(0, stepIndex(input.channel, input.status));
  for (const e of input.events) {
    if (e.status) reached = Math.max(reached, stepIndex(input.channel, e.status));
  }

  // Première date connue de chaque étape.
  const firstAt: (string | null)[] = keys.map(() => null);
  firstAt[0] = iso(input.createdAt);
  const sorted = [...input.events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  for (const e of sorted) {
    if (!e.status) continue;
    const i = stepIndex(input.channel, e.status);
    if (i > 0 && !firstAt[i]) firstAt[i] = iso(e.at);
  }
  if (!firstAt[1]) firstAt[1] = iso(input.sentAt);
  if (input.channel === "EMAIL") {
    if (!firstAt[2]) firstAt[2] = iso(input.deliveredAt);
    if (!firstAt[3]) firstAt[3] = iso(input.openedAt);
  }
  // Une étape franchie sans événement daté (webhook manquant) n'a pas d'horodatage inventé.
  const interruptionAt = interrupted
    ? iso([...sorted].reverse().find((e) => e.status === input.status)?.at ?? null)
    : null;

  // L'interruption occupe l'étape qui suit la dernière atteinte (ou la dernière s'il n'y en a plus).
  const breakAt = interrupted ? Math.min(reached + 1, last) : -1;
  const lastDone = interrupted && breakAt === reached ? reached - 1 : reached;

  return keys.map((key, i) => {
    if (i === breakAt) {
      return { key, state: input.status === "cancelled" ? "cancelled" : "error", at: interruptionAt, status: input.status };
    }
    if (i <= lastDone) {
      const isCurrent = !interrupted && i === lastDone && i < last;
      return { key, state: isCurrent ? "current" : "done", at: firstAt[i] ?? null, status: null };
    }
    return { key, state: "upcoming", at: null, status: null };
  });
}

/** Vrai tant qu'un envoi peut encore évoluer (actualisation automatique). */
export function isLiveStatus(status: DispatchStatus): boolean {
  return !["opened", "posted", "cancelled"].includes(status) && !isErrorStatus(status);
}
