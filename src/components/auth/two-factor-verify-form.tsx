"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { fr } from "@/lib/i18n/fr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function TwoFactorVerifyForm({ demoCode }: { demoCode: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [trust, setTrust] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = backup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: trust })
      : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice: trust });
    setPending(false);
    if (res.error) {
      setError(res.error.status === 429 ? fr.auth.tooManyAttempts : fr.auth.invalidCode);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-fg">
          <ShieldCheck aria-hidden /> {fr.auth.twoFactorTitle}
        </h1>
        <p className="text-muted-foreground">{backup ? fr.auth.backupCodesHint : fr.auth.twoFactorSubtitle}</p>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="code">{backup ? fr.auth.useBackupCode : fr.auth.code}</Label>
        <Input
          id="code"
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={backup ? 20 : 6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 text-center text-2xl tracking-[0.5em]"
        />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="trust" checked={trust} onCheckedChange={(v) => setTrust(v === true)} />
        <Label htmlFor="trust" className="font-normal">
          {fr.auth.trustDevice}
        </Label>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : null}
        {fr.auth.verify}
      </Button>
      <button type="button" className="text-sm text-brand-fg underline-offset-4 hover:underline" onClick={() => setBackup((b) => !b)}>
        {backup ? fr.auth.code : fr.auth.useBackupCode}
      </button>
      {demoCode ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {fr.auth.demoTotp(demoCode)}{" "}
          <button type="button" className="underline" onClick={() => router.refresh()}>
            actualiser
          </button>
        </p>
      ) : null}
    </form>
  );
}
