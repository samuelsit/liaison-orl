import type { Metadata } from "next";
import { createOTP } from "@better-auth/utils/otp";
import { TwoFactorVerifyForm } from "@/components/auth/two-factor-verify-form";
import { DEMO_ADMIN_TOTP_SECRET } from "@/lib/demo";
import { showDemoLoginHints } from "@/lib/env";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: fr.auth.twoFactorTitle };

export default async function VerificationPage() {
  const demoCode = showDemoLoginHints() ? await createOTP(DEMO_ADMIN_TOTP_SECRET).totp() : null;
  return <TwoFactorVerifyForm demoCode={demoCode} />;
}
