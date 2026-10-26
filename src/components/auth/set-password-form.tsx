"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { fr } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function SetPasswordForm({ token, title, intro }: { token: string | null; title: string; intro: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : fr.auth.invalidLink);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 10) return setError(fr.auth.passwordTooShort);
    if (password !== confirm) return setError(fr.auth.passwordMismatch);
    setPending(true);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (res.error) {
      setError(fr.auth.invalidLink);
      return;
    }
    toast.success(fr.auth.passwordUpdated);
    router.replace("/connexion");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-fg">{title}</h1>
        <p className="text-muted-foreground">{intro}</p>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="new-password">{fr.auth.newPassword}</Label>
        <Input id="new-password" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-xs text-muted-foreground">{fr.auth.passwordTooShort}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">{fr.auth.confirmPassword}</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending || !token}>
        {pending ? <Spinner /> : null}
        {fr.auth.setPasswordSubmit}
      </Button>
    </form>
  );
}
