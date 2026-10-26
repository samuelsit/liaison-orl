import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER, requestedPath } from "@/lib/navigation";

/**
 * Content-Security-Policy des pages, avec un nonce par requête : seuls les scripts émis
 * par l'application (Next.js, next-themes) s'exécutent ; aucun script inline injecté ne passe.
 * Les styles restent en 'unsafe-inline' (attributs style de Radix, Framer Motion, aperçu PDF).
 * Les routes /api gardent la politique statique définie dans next.config.ts.
 *
 * Transmet aussi le chemin demandé (en-tête interne, toujours réécrit ici) : si la session
 * a expiré, la page de connexion y ramène ensuite l'utilisateur (`?suite=`, chemin vérifié).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set(REQUEST_PATH_HEADER, requestedPath(request.nextUrl.pathname, request.nextUrl.search));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
