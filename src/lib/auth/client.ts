"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";

/** La redirection vers l'étape 2FA est gérée par le formulaire de connexion. */
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), magicLinkClient()],
});
