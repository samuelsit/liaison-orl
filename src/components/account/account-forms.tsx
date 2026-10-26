"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ImageUp, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { FormField } from "@/components/forms/form-field";
import { authClient } from "@/lib/auth/client";
import { updateProfileAction, updateSignatureAction } from "@/server/actions/account";
import { fr } from "@/lib/i18n/fr";

const noopSubscribe = () => () => {};

export function AccountForms({ profile, signature, twoFactorEnabled, email }: { profile: { firstName: string; lastName: string; title: string }; signature: string | null; twoFactorEnabled: boolean; email: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  // Le thème vient du localStorage : inconnu au rendu serveur, on ne le sélectionne qu'après l'hydratation.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [p, setP] = useState(profile);
  const [sig, setSig] = useState(signature);
  const [pwd, setPwd] = useState({ current: "", next: "" });
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Profil</h2>
        <p className="text-sm text-muted-foreground">{email}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="first" label="Prénom">
            <Input id="first" value={p.firstName} onChange={(e) => setP({ ...p, firstName: e.target.value })} />
          </FormField>
          <FormField id="last" label="Nom">
            <Input id="last" value={p.lastName} onChange={(e) => setP({ ...p, lastName: e.target.value })} />
          </FormField>
        </div>
        <FormField id="title" label="Titre (imprimé sous votre nom)">
          <Input id="title" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
        </FormField>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await updateProfileAction(p);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message ?? "Enregistré.");
              router.refresh();
            })
          }
        >
          <Save aria-hidden /> Enregistrer
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Signature scannée</h2>
        <p className="text-sm text-muted-foreground">Imprimée sur vos courriers et comptes rendus (si l&apos;option est active). Photographiez votre signature à l&apos;encre foncée sur papier blanc.</p>
        <div className="flex h-28 items-center justify-center rounded-lg border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {sig ? <img src={sig} alt="Votre signature" className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-muted-foreground">Aucune signature</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-accent focus-within:outline-2">
            <ImageUp className="size-4" aria-hidden /> Choisir une image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () =>
                  start(async () => {
                    const res = await updateSignatureAction(String(reader.result));
                    if (!res.ok) return void toast.error(res.error);
                    setSig(String(reader.result));
                    toast.success(res.message ?? "Enregistrée.");
                    router.refresh();
                  });
                reader.readAsDataURL(f);
              }}
            />
          </label>
          {sig ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() =>
                start(async () => {
                  const res = await updateSignatureAction(null);
                  if (!res.ok) return void toast.error(res.error);
                  setSig(null);
                  toast.success(res.message ?? "Supprimée.");
                })
              }
            >
              <Trash2 aria-hidden /> Supprimer
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Mot de passe</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pwd.next.length < 10) return void toast.error(fr.auth.passwordTooShort);
            start(async () => {
              const res = await authClient.changePassword({ currentPassword: pwd.current, newPassword: pwd.next, revokeOtherSessions: true });
              if (res.error) return void toast.error("Mot de passe actuel incorrect.");
              setPwd({ current: "", next: "" });
              toast.success("Mot de passe modifié. Vos autres sessions ont été fermées.");
            });
          }}
        >
          <FormField id="cur" label="Mot de passe actuel">
            <Input id="cur" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
          </FormField>
          <FormField id="new" label="Nouveau mot de passe" hint="10 caractères minimum.">
            <Input id="new" type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
          </FormField>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Changer le mot de passe
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Sécurité et affichage</h2>
        <p className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" aria-hidden /> Double authentification : <strong>{twoFactorEnabled ? "activée" : "désactivée"}</strong>
        </p>
        {!twoFactorEnabled ? (
          <Button asChild variant="outline">
            <Link href="/securite/2fa">Activer la double authentification</Link>
          </Button>
        ) : null}
        <div>
          <p className="mb-2 text-sm font-medium">{fr.nav.theme}</p>
          <SegmentedControl value={hydrated ? (theme ?? "light") : ""} onValueChange={setTheme} aria-label={fr.nav.theme}>
            <SegmentedControlItem value="light">{fr.nav.themeLight}</SegmentedControlItem>
            <SegmentedControlItem value="dark">{fr.nav.themeDark}</SegmentedControlItem>
            <SegmentedControlItem value="system">{fr.nav.themeSystem}</SegmentedControlItem>
          </SegmentedControl>
        </div>
      </section>
    </div>
  );
}
