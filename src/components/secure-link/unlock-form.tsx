"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { unlockSecureLinkAction, type UnlockState } from "@/server/actions/secure-link";

export function UnlockForm({ token, factor }: { token: string; factor: "birthdate" | "code" }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockSecureLinkAction.bind(null, token), {
    error: null,
    unlocked: false,
  });
  useEffect(() => {
    if (state.unlocked) router.refresh();
  }, [state.unlocked, router]);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="valeur">
          {factor === "birthdate" ? "Date de naissance du patient" : "Code d'accès reçu par e-mail"}
        </Label>
        <Input
          id="valeur"
          name="valeur"
          required
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          placeholder={factor === "birthdate" ? "JJ/MM/AAAA" : "6 chiffres"}
          maxLength={factor === "birthdate" ? 10 : 6}
          className="h-12 text-lg"
        />
      </div>
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="h-12 w-full" disabled={pending}>
        <LockKeyhole aria-hidden /> Accéder au document
      </Button>
    </form>
  );
}
