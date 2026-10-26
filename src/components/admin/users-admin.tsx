"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Pencil, ShieldCheck, ShieldOff, UserPlus, UserRoundX, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/forms/form-field";
import { inviteUserAction, resendInvitationAction, resetTwoFactorAction, setUserActiveAction, updateUserAction } from "@/server/actions/admin";
import type { UserRow } from "@/server/services/admin";
import type { Role } from "@/lib/schemas/common";
import { formatDateTime } from "@/lib/dates";
import { fr } from "@/lib/i18n/fr";

interface Draft {
  id: string | null;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  role: Role;
  centreIds: string[];
  canSend: boolean;
}

export function UsersAdmin({ users, centres, currentUserId }: { users: UserRow[]; centres: { id: string; name: string }[]; currentUserId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const centreName = Object.fromEntries(centres.map((c) => [c.id, c.name]));
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Effectué.");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDraft({ id: null, email: "", firstName: "", lastName: "", title: "Audioprothésiste D.E", role: "audioprothesiste", centreIds: [], canSend: false })} data-testid="invite-user">
          <UserPlus aria-hidden /> Inviter un utilisateur
        </Button>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {u.firstName} {u.lastName.toUpperCase()}
                <Badge tone="outline">{fr.roles[u.role]}</Badge>
                {!u.active ? <Badge tone="danger">Désactivé</Badge> : null}
                {u.twoFactorEnabled ? (
                  <Badge tone="outline">
                    <ShieldCheck className="size-3" aria-hidden /> 2FA
                  </Badge>
                ) : u.role === "admin" ? (
                  <Badge tone="warning">
                    2FA à configurer
                  </Badge>
                ) : null}
                {u.role === "assistant" && u.canSend ? <Badge tone="outline">Peut envoyer</Badge> : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {u.email} · {u.role === "admin" ? "Tous les centres" : u.centreIds.map((c) => centreName[c]).filter(Boolean).join(", ") || "Aucun centre"}
                {u.lastLogin ? ` · dernière connexion ${formatDateTime(u.lastLogin)}` : " · jamais connecté"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDraft({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, title: u.title, role: u.role, centreIds: u.centreIds, canSend: u.canSend })}>
                  <Pencil aria-hidden /> Modifier
                </DropdownMenuItem>
                {!u.lastLogin ? (
                  <DropdownMenuItem onSelect={() => act(() => resendInvitationAction(u.id))}>
                    <Mail aria-hidden /> Renvoyer l&apos;invitation
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => act(() => resendInvitationAction(u.id))}>
                    <KeyRound aria-hidden /> Envoyer un lien de mot de passe
                  </DropdownMenuItem>
                )}
                {u.twoFactorEnabled ? (
                  <DropdownMenuItem onSelect={() => act(() => resetTwoFactorAction(u.id))}>
                    <ShieldOff aria-hidden /> Réinitialiser la 2FA
                  </DropdownMenuItem>
                ) : null}
                {u.id !== currentUserId ? (
                  <DropdownMenuItem onSelect={() => act(() => setUserActiveAction(u.id, !u.active))}>
                    {u.active ? <UserRoundX aria-hidden /> : <UserRoundCheck aria-hidden />}
                    {u.active ? "Désactiver le compte" : "Réactiver le compte"}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier l'utilisateur" : "Inviter un utilisateur"}</DialogTitle>
            <DialogDescription>{draft?.id ? draft.email : "Un e-mail d'activation (valable 48 h) lui permettra de choisir son mot de passe."}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <DialogBody>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const payload = { email: draft.email, firstName: draft.firstName, lastName: draft.lastName, title: draft.title, role: draft.role, centreIds: draft.centreIds, canSend: draft.canSend };
                start(async () => {
                  const res = draft.id ? await updateUserAction(draft.id, payload) : await inviteUserAction(payload);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(res.message ?? "Enregistré.");
                  setDraft(null);
                  router.refresh();
                });
              }}
            >
              {!draft.id ? (
                <FormField id="u-email" label="E-mail" required>
                  <Input id="u-email" type="email" required value={draft.email} onChange={(e) => set({ email: e.target.value })} />
                </FormField>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="u-first" label="Prénom" required>
                  <Input id="u-first" required value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} />
                </FormField>
                <FormField id="u-last" label="Nom" required>
                  <Input id="u-last" required value={draft.lastName} onChange={(e) => set({ lastName: e.target.value })} />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="u-title" label="Titre (sur les documents)">
                  <Input id="u-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
                </FormField>
                <FormField id="u-role" label="Rôle">
                  <Select value={draft.role} onValueChange={(v) => set({ role: v as Role })} disabled={draft.id === currentUserId}>
                    <SelectTrigger id="u-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(fr.roles) as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {fr.roles[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              {draft.role !== "admin" ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Centres rattachés</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {centres.map((c) => (
                      <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm">
                        <Checkbox checked={draft.centreIds.includes(c.id)} onCheckedChange={(v) => set({ centreIds: v ? [...draft.centreIds, c.id] : draft.centreIds.filter((x) => x !== c.id) })} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="text-sm text-muted-foreground">Un administrateur accède à tous les centres. La double authentification lui sera demandée à la première connexion.</p>
              )}
              {draft.role === "assistant" ? (
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Switch checked={draft.canSend} onCheckedChange={(canSend) => set({ canSend })} /> Autoriser cet(te) assistant(e) à envoyer les documents validés
                </label>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending}>
                  {draft.id ? "Enregistrer" : "Envoyer l'invitation"}
                </Button>
              </DialogFooter>
            </form>
            </DialogBody>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
