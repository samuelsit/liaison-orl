"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { fr } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Step = "password" | "scan" | "done";

export function TwoFactorSetup({ issuer, mandatory }: { issuer: string; mandatory: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await authClient.twoFactor.enable({ password, issuer });
    setPending(false);
    if (res.error || !res.data || !("totpURI" in res.data) || !res.data.totpURI) {
      setError(res.error?.status === 400 ? fr.auth.invalidCredentials : (res.error?.message ?? fr.common.unknownError));
      return;
    }
    const uri = res.data.totpURI;
    setSecret(new URL(uri).searchParams.get("secret") ?? "");
    setBackupCodes(res.data.backupCodes ?? []);
    setQr(await QRCode.toDataURL(uri, { margin: 1, width: 220 }));
    setStep("scan");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
    setPending(false);
    if (res.error) {
      setError(fr.auth.invalidCode);
      return;
    }
    toast.success(fr.auth.setup2faDone);
    setStep("done");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-fg">
          <ShieldCheck aria-hidden /> {fr.auth.setup2faTitle}
        </h1>
        {mandatory ? <p className="text-muted-foreground">{fr.auth.setup2faSubtitle}</p> : null}
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === "password" ? (
        <form onSubmit={start} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pwd">{fr.auth.setup2faPassword}</Label>
            <Input id="pwd" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Spinner /> : null}
            {fr.auth.setup2faStart}
          </Button>
        </form>
      ) : null}

      {step === "scan" ? (
        <form onSubmit={verify} className="space-y-5">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code à scanner avec votre application d'authentification" className="mx-auto rounded-lg border bg-white p-2" width={220} height={220} />
          ) : null}
          <div className="space-y-1 text-center">
            <p className="text-sm text-muted-foreground">{fr.auth.setup2faSecret}</p>
            <div className="flex items-center justify-center gap-2">
              <code data-testid="totp-secret" className="rounded bg-muted px-2 py-1 text-sm break-all">
                {secret}
              </code>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={fr.common.copy}
                onClick={() => {
                  void navigator.clipboard.writeText(secret);
                  toast.success(fr.common.copied);
                }}
              >
                <Copy aria-hidden />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="totp">{fr.auth.code}</Label>
            <Input id="totp" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="h-12 text-center text-2xl tracking-[0.5em]" />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Spinner /> : null}
            {fr.auth.verify}
          </Button>
        </form>
      ) : null}

      {step === "done" ? (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="font-semibold">{fr.auth.backupCodes}</p>
            <p className="mb-3 text-sm text-muted-foreground">{fr.auth.backupCodesHint}</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((c) => (
                <li key={c} className="rounded bg-muted px-2 py-1 text-center">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <Button
            size="lg" className="w-full"
            onClick={() => {
              router.replace("/");
              router.refresh();
            }}
          >
            {fr.common.next}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
