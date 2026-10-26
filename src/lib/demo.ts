/**
 * Comptes de démonstration créés par `npm run seed` (données entièrement fictives).
 * Ne jamais utiliser ces identifiants sur une base de production.
 */
export const DEMO_PASSWORD = "Demo-Liaison-2026!";

/** Secret TOTP du compte administrateur de démonstration (brut, encodé en base32 pour les applications). */
export const DEMO_ADMIN_TOTP_SECRET = "demo-totp-secret-liaison-orl-2026";

export const DEMO_ACCOUNTS = [
  { email: "direction@demo.test", role: "admin" as const, label: "Administratrice (2FA)" },
  { email: "claire.morel@demo.test", role: "audioprothesiste" as const, label: "Audioprothésiste — Île-de-France" },
  { email: "julien.bernard@demo.test", role: "audioprothesiste" as const, label: "Audioprothésiste — Normandie" },
  { email: "karim.haddad@demo.test", role: "audioprothesiste" as const, label: "Audioprothésiste — Val-d'Oise / Seine-Saint-Denis" },
  { email: "lea.petit@demo.test", role: "assistant" as const, label: "Assistante (sans droit d'envoi)" },
  { email: "nadia.roux@demo.test", role: "assistant" as const, label: "Assistante (avec droit d'envoi)" },
];
