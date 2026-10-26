import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";
import { showDemoLoginHints } from "@/lib/env";
import { fr } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: fr.auth.signInTitle };

export default async function LoginPage() {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/");
  const demo = showDemoLoginHints() ? { accounts: DEMO_ACCOUNTS, password: DEMO_PASSWORD } : null;
  return <LoginForm demo={demo} />;
}
