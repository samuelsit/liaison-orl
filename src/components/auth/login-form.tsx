"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { fr } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

interface DemoInfo {
  accounts: readonly { email: string; label: string }[];
  password: string;
}

function errorMessage(status: number | undefined, message: string | undefined) {
  if (status === 429) return fr.auth.tooManyAttempts;
  if (status === 401 || message?.toLowerCase().includes("invalid")) return fr.auth.invalidCredentials;
  return message || fr.common.unknownError;
}

export function LoginForm({ demo }: { demo: DemoInfo | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      setError(errorMessage(res.error.status, res.error.message));
      return;
    }
    if (res.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) {
      router.push("/connexion/verification");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await authClient.signIn.magicLink({ email, callbackURL: "/" });
    setPending(false);
    if (res.error) {
      setError(res.error.status === 403 ? (res.error.message ?? fr.common.forbidden) : errorMessage(res.error.status, res.error.message));
      return;
    }
    setInfo(fr.auth.magicLinkSent);
  }

  async function forgotPassword() {
    if (!email) {
      setError("Saisissez d'abord votre adresse e-mail.");
      return;
    }
    setError(null);
    await authClient.requestPasswordReset({ email, redirectTo: "/reinitialisation" });
    setInfo(fr.auth.resetSent);
    toast.success(fr.auth.resetSent);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center lg:text-left">
        <h1 className="text-2xl font-bold text-brand-fg">{fr.auth.signInTitle}</h1>
        <p className="text-muted-foreground">{fr.auth.signInSubtitle}</p>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {info ? (
        <Alert role="status">
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="password">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">
            <KeyRound aria-hidden /> {fr.auth.passwordTab}
          </TabsTrigger>
          <TabsTrigger value="magic">
            <Mail aria-hidden /> {fr.auth.magicLinkTab}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="password">
          <form onSubmit={signInPassword} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="email">{fr.auth.email}</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{fr.auth.password}</Label>
                <button type="button" onClick={forgotPassword} className="text-sm text-brand-fg underline-offset-4 hover:underline">
                  {fr.auth.forgotPassword}
                </button>
              </div>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? <Spinner /> : null}
              {pending ? fr.auth.signingIn : fr.auth.signIn}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="magic">
          <form onSubmit={sendMagicLink} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="email-magic">{fr.auth.email}</Label>
              <Input id="email-magic" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? <Spinner /> : <Mail aria-hidden />}
              {fr.auth.sendMagicLink}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {demo ? (
        <div className="rounded-xl border border-dashed bg-card p-4">
          <p className="mb-3 text-sm font-semibold">{fr.auth.demoAccounts}</p>
          <ul className="space-y-2">
            {demo.accounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(demo.password);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent"
                >
                  <UserRound className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-medium">{a.label}</span>
                    <span className="block text-muted-foreground">{a.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Mot de passe : <code className="rounded bg-muted px-1 py-0.5">{demo.password}</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}
