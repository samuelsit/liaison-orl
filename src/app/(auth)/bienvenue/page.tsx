import { SetPasswordForm } from "@/components/auth/set-password-form";
import { fr } from "@/lib/i18n/fr";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return <SetPasswordForm token={error ? null : (token ?? null)} title={fr.auth.setPasswordTitle} intro={"Bienvenue ! Choisissez le mot de passe de votre compte."} />;
}
