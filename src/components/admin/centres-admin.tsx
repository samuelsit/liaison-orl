"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { saveCentreAction } from "@/server/actions/admin";
import type { CentreInput } from "@/lib/schemas/centre";

export interface CentreRow extends CentreInput {
  id: string;
  users: number;
  documents: number;
}

const EMPTY: CentreInput = {
  name: "",
  address: { line1: "", line2: "", postalCode: "", city: "", country: "FRANCE" },
  phone: "",
  email: "",
  defaultSignature: "",
  senderAddress: null,
  active: true,
};

export function CentresAdmin({ rows, brandName }: { rows: CentreRow[]; brandName: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ id: string | null; value: CentreInput } | null>(null);
  const [pending, start] = useTransition();
  const v = edit?.value;
  const set = (patch: Partial<CentreInput>) => setEdit((e) => (e ? { ...e, value: { ...e.value, ...patch } } : e));
  const setAddr = (patch: Partial<CentreInput["address"]>) => setEdit((e) => (e ? { ...e, value: { ...e.value, address: { ...e.value.address, ...patch } } } : e));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEdit({ id: null, value: EMPTY })}>
          <Plus aria-hidden /> Nouveau centre
        </Button>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Building2 className="size-5 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {brandName} — {c.name} {!c.active ? <Badge tone="outline">Inactif</Badge> : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {[c.address.line1, `${c.address.postalCode} ${c.address.city}`, c.phone, c.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              {c.users} utilisateur(s) · {c.documents} document(s)
            </span>
            <Button variant="ghost" size="icon" aria-label={`Modifier ${c.name}`} onClick={() => setEdit({ id: c.id, value: c })}>
              <Pencil aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifier le centre" : "Nouveau centre"}</DialogTitle>
            <DialogDescription>Le nom ne contient que la localité : le nom de marque est ajouté automatiquement.</DialogDescription>
          </DialogHeader>
          {v ? (
            <DialogBody>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await saveCentreAction(edit!.id, v);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(res.message ?? "Enregistré.");
                  setEdit(null);
                  router.refresh();
                });
              }}
            >
              <FormField id="c-name" label="Nom (localité)" required>
                <Input id="c-name" value={v.name} onChange={(e) => set({ name: e.target.value })} required />
              </FormField>
              <FormField id="c-l1" label="Adresse">
                <Input id="c-l1" value={v.address.line1} onChange={(e) => setAddr({ line1: e.target.value })} />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <FormField id="c-cp" label="Code postal">
                  <Input id="c-cp" value={v.address.postalCode} onChange={(e) => setAddr({ postalCode: e.target.value })} />
                </FormField>
                <FormField id="c-city" label="Ville">
                  <Input id="c-city" value={v.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="c-phone" label="Téléphone">
                  <Input id="c-phone" value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
                </FormField>
                <FormField id="c-email" label="E-mail (réponses des médecins)">
                  <Input id="c-email" type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} />
                </FormField>
              </div>
              <FormField id="c-sign" label="Signature par défaut (e-mails)">
                <Textarea id="c-sign" value={v.defaultSignature} onChange={(e) => set({ defaultSignature: e.target.value })} rows={2} />
              </FormField>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Switch checked={v.active} onCheckedChange={(active) => set({ active })} /> Centre actif
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending}>
                  Enregistrer
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
