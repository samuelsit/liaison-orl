import { SetPasswordForm } from "@/components/auth/set-password-form";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return <SetPasswordForm token={error ? null : (token ?? null)} title={"Nouveau mot de passe"} intro={"Choisissez un nouveau mot de passe pour votre compte."} />;
}
