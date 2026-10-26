import { shellFr } from "@/lib/i18n/shell";

const TZ = "Europe/Paris";

/** Heure (0-23) à Paris, quelle que soit la zone du serveur. */
export function parisHour(now: Date): number {
  const h = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now);
  return Number.parseInt(h, 10);
}

/** « Bonjour Claire » jusqu'à 18 h, « Bonsoir Claire » ensuite (heure de Paris). */
export function homeGreeting(firstName: string, now: Date): string {
  return parisHour(now) >= 18 ? shellFr.home.greetingEvening(firstName) : shellFr.home.greetingMorning(firstName);
}

/** Date du jour en surtitre de l'accueil : « Samedi 18 octobre ». */
export function homeDateLine(now: Date): string {
  const text = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
