/**
 * Retour à la page demandée après la connexion (paramètre `?suite=`).
 * Seuls les chemins relatifs de la même origine sont acceptés : tout le reste
 * (URL absolue, « //hôte », « /\hôte », caractères de contrôle…) retombe sur l'accueil.
 */

const FALLBACK = "/";
const PROBE_ORIGIN = "http://liaison.invalid";
/** Pages d'authentification : y revenir après la connexion n'aurait pas de sens. */
const AUTH_PATHS = ["/connexion", "/reinitialisation", "/bienvenue"];

/** Nom du paramètre de retour dans l'URL de connexion. */
export const NEXT_PARAM = "suite";

/** En-tête interne posé par le proxy : chemin et requête de la page demandée. */
export const REQUEST_PATH_HEADER = "x-pathname";

export function safeNext(value: unknown, fallback: string = FALLBACK): string {
  if (typeof value !== "string") return fallback;
  if (value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Le navigateur lit « \ » comme « / » et ignore tabulations et retours à la ligne.
  if (/[\\\u0000-\u001F\u007F]/.test(value)) return fallback;
  if (value.includes("://")) return fallback;
  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;
  if (AUTH_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Chemin + requête d'une page, sans le paramètre technique `_rsc` des navigations client. */
export function requestedPath(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete("_rsc");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

/** URL de connexion qui ramène ensuite sur `path` (sans paramètre pour l'accueil). */
export function loginHref(path: string | null | undefined): string {
  const next = safeNext(path);
  return next === FALLBACK ? "/connexion" : `/connexion?${NEXT_PARAM}=${encodeURIComponent(next)}`;
}

/** Ajoute `?suite=` à une URL interne quand la destination n'est pas l'accueil. */
export function withNext(href: string, next: string): string {
  const safe = safeNext(next);
  if (safe === FALLBACK) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${NEXT_PARAM}=${encodeURIComponent(safe)}`;
}
