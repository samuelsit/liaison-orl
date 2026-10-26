import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Politique stricte pour les réponses /api (JSON, PDF) ; les pages reçoivent une CSP
// avec nonce par requête, générée dans src/proxy.ts.
const apiCsp = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@react-pdf/renderer", "fontkit", "pdfjs-dist", "mongodb-memory-server", "mongodb-connection-string-url", "sharp"],
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**/*", "./assets/brand/**/*"],
    "/api/pdf-worker": ["./node_modules/pdfjs-dist/build/pdf.worker.min.mjs"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/(.*)", headers: [{ key: "Content-Security-Policy", value: apiCsp }] },
      { source: "/l/(.*)", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
