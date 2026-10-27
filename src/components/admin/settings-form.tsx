"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { updateSettingsAction } from "@/server/actions/admin";
import { renderSubject, renderTemplate, TEMPLATE_VARIABLES, type TemplateVars } from "@/lib/dispatch/template";
import { DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT } from "@/lib/brand";
import type { DeliveryProduct, OrganizationSettings } from "@/lib/schemas/organization";
import { fr } from "@/lib/i18n/fr";

const SAMPLE: TemplateVars = {
  "document.type": "Compte rendu d'appareillage",
  "document.type_minuscule": "compte rendu d'appareillage",
  "document.date": "17/10/2026",
  "patient.civilite": "Mme",
  "patient.nom": "EXEMPLE",
  "patient.prenom": "Jeanne",
  "patient.initiales": "J. E.",
  "prescripteur.formule": "Cher Confrère",
  "prescripteur.nom": "Dr Antoine MODÈLE",
  "centre.nom": "Marque — Ville",
  "centre.telephone": "01 99 00 00 00",
  "centre.email": "centre@exemple.test",
  "audioprothesiste.nom": "Camille EXEMPLE",
  "audioprothesiste.titre": "Audioprothésiste D.E",
  acces: "Pour consulter le document, cliquez sur le lien sécurisé puis saisissez la date de naissance du patient (lien valable 30 jours).",
  validite: "30 jours",
};

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-start gap-3 text-sm">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Paramètres de l'organisation : section « modèles » ou « envois et droits ». */
export function SettingsForm({ initial, section }: { initial: OrganizationSettings; section: "modeles" | "envois" }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [newSalutation, setNewSalutation] = useState("");
  const [pending, start] = useTransition();
  const preview = useMemo(() => ({ subject: renderSubject(s.email.subjectTemplate, SAMPLE), body: renderTemplate(s.email.bodyTemplate, SAMPLE) }), [s.email.subjectTemplate, s.email.bodyTemplate]);

  function save() {
    start(async () => {
      const res = await updateSettingsAction(s);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Enregistré.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {section === "modeles" ? (
        <>
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">E-mail envoyé aux prescripteurs</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <FormField id="subject" label="Objet">
                  <Input id="subject" value={s.email.subjectTemplate} onChange={(e) => setS({ ...s, email: { ...s.email, subjectTemplate: e.target.value } })} />
                </FormField>
                <FormField id="body" label="Corps du message">
                  <Textarea id="body" value={s.email.bodyTemplate} onChange={(e) => setS({ ...s, email: { ...s.email, bodyTemplate: e.target.value } })} rows={14} className="font-mono text-sm" />
                </FormField>
                <Button variant="ghost" size="sm" onClick={() => setS({ ...s, email: { ...s.email, subjectTemplate: DEFAULT_EMAIL_SUBJECT, bodyTemplate: DEFAULT_EMAIL_BODY } })}>
                  Rétablir le modèle par défaut
                </Button>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">Variables disponibles</summary>
                  <ul className="mt-2 space-y-1">
                    {TEMPLATE_VARIABLES.map(([k, label]) => (
                      <li key={k}>
                        <code className="rounded bg-muted px-1">{`{{${k}}}`}</code> — {label}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">Aperçu (données fictives)</p>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                  <p className="mb-3 font-semibold">{preview.subject}</p>
                  <p className="whitespace-pre-wrap">{preview.body}</p>
                </div>
                {/(\{\{\s*patient\.nom\s*\}\})|(\{\{\s*patient\.prenom\s*\}\})/.test(s.email.subjectTemplate) ? (
                  <p className="mt-2 flex items-start gap-2 text-sm text-warning-foreground">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> L&apos;objet d&apos;un e-mail circule en clair : préférez les initiales du patient.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Formules d&apos;appel</h2>
            <FormField id="default-salutation" label="Formule par défaut (si le prescripteur n'en a pas)">
              <Input id="default-salutation" value={s.documents.defaultSalutation} onChange={(e) => setS({ ...s, documents: { ...s.documents, defaultSalutation: e.target.value } })} />
            </FormField>
            <ul className="flex flex-wrap gap-2">
              {s.documents.salutations.map((v) => (
                <li key={v} className="inline-flex items-center gap-1 rounded-full border bg-background py-1 pr-1 pl-3 text-sm">
                  {v}
                  <button type="button" aria-label={`Retirer ${v}`} className="rounded-full p-1 hover:bg-accent" onClick={() => setS({ ...s, documents: { ...s.documents, salutations: s.documents.salutations.filter((x) => x !== v) } })}>
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = newSalutation.trim();
                if (v && !s.documents.salutations.includes(v)) setS({ ...s, documents: { ...s.documents, salutations: [...s.documents.salutations, v] } });
                setNewSalutation("");
              }}
            >
              <Input aria-label="Nouvelle formule" placeholder="Nouvelle formule…" value={newSalutation} onChange={(e) => setNewSalutation(e.target.value)} className="h-10" />
              <Button type="submit" variant="outline">
                <Plus aria-hidden /> Ajouter
              </Button>
            </form>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Assistance IA et options des documents</h2>
            <Toggle id="ai-enabled" label="Assistance IA activée" hint="Lecture des bilans, rédaction des commentaires et motifs, nettoyage des dictées." checked={s.ai.enabled} onChange={(enabled) => setS({ ...s, ai: { ...s.ai, enabled } })} />
            <Toggle
              id="ai-dictation"
              label="Dictée vocale"
              hint="Reconnaissance vocale du navigateur. Attention : Chrome et Edge transmettent l'audio aux serveurs de Google ou Microsoft. Désactivez si vos règles de confidentialité l'exigent."
              checked={s.ai.dictation}
              onChange={(dictation) => setS({ ...s, ai: { ...s.ai, dictation } })}
            />
            <FormField id="tone" label="Ton des rédactions" hint="Décrit le style attendu (ex. « confraternel, factuel, sobre et concis »).">
              <Input id="tone" value={s.ai.tone} onChange={(e) => setS({ ...s, ai: { ...s.ai, tone: e.target.value } })} />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="minl" label="Commentaire : lignes minimum">
                <Input id="minl" type="number" min={2} max={10} value={s.ai.commentMinLines} onChange={(e) => setS({ ...s, ai: { ...s.ai, commentMinLines: Number(e.target.value) } })} />
              </FormField>
              <FormField id="maxl" label="Commentaire : lignes maximum">
                <Input id="maxl" type="number" min={3} max={12} value={s.ai.commentMaxLines} onChange={(e) => setS({ ...s, ai: { ...s.ai, commentMaxLines: Number(e.target.value) } })} />
              </FormField>
            </div>
            <Toggle id="signature" label="Imprimer la signature scannée de l'audioprothésiste" checked={s.documents.showSignature} onChange={(showSignature) => setS({ ...s, documents: { ...s.documents, showSignature } })} />
            <Toggle id="annex" label="Audiogramme et gain prothétique inclus par défaut dans les comptes rendus" checked={s.documents.audiogramAnnex} onChange={(audiogramAnnex) => setS({ ...s, documents: { ...s.documents, audiogramAnnex } })} />
          </section>
        </>
      ) : (
        <>
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">E-mail</h2>
            <FormField id="mode" label="Transmission du document">
              <Select value={s.email.mode} onValueChange={(v) => setS({ ...s, email: { ...s.email, mode: v as typeof s.email.mode } })}>
                <SelectTrigger id="mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="secure-link">Lien sécurisé à durée limitée (recommandé)</SelectItem>
                  <SelectItem value="attachment">PDF joint directement à l&apos;e-mail</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {s.email.mode === "attachment" ? (
              <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning p-3 text-sm text-warning-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Le PDF circulera en clair et restera dans les boîtes de réception : réservez cette option à une messagerie sécurisée de santé ou à un accord explicite de vos correspondants.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="factor" label="Second facteur demandé au médecin">
                  <Select value={s.email.secondFactor} onValueChange={(v) => setS({ ...s, email: { ...s.email, secondFactor: v as typeof s.email.secondFactor } })}>
                    <SelectTrigger id="factor" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="birthdate">Date de naissance du patient</SelectItem>
                      <SelectItem value="code">Code envoyé dans un second e-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="validity" label="Validité du lien (jours)">
                  <Input id="validity" type="number" min={1} max={90} value={s.email.linkValidityDays} onChange={(e) => setS({ ...s, email: { ...s.email, linkValidityDays: Number(e.target.value) } })} />
                </FormField>
              </div>
            )}
            <Toggle id="cc" label="Mettre le centre en copie par défaut" checked={s.email.copyToCentre} onChange={(copyToCentre) => setS({ ...s, email: { ...s.email, copyToCentre } })} />
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Courrier postal (Pingen)</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id="product" label="Affranchissement par défaut">
                <Select value={s.postal.deliveryProduct} onValueChange={(v) => setS({ ...s, postal: { ...s.postal, deliveryProduct: v as DeliveryProduct } })}>
                  <SelectTrigger id="product" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(fr.deliveryProducts) as DeliveryProduct[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {fr.deliveryProducts[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="spectrum" label="Impression">
                <Select value={s.postal.printSpectrum} onValueChange={(v) => setS({ ...s, postal: { ...s.postal, printSpectrum: v as "color" | "grayscale" } })}>
                  <SelectTrigger id="spectrum" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="color">Couleur</SelectItem>
                    <SelectItem value="grayscale">Noir et blanc</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="print" label="Recto / verso">
                <Select value={s.postal.printMode} onValueChange={(v) => setS({ ...s, postal: { ...s.postal, printMode: v as "simplex" | "duplex" } })}>
                  <SelectTrigger id="print" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simplex">Recto</SelectItem>
                    <SelectItem value="duplex">Recto-verso</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <p className="text-xs text-muted-foreground">Fenêtre d&apos;enveloppe à droite (norme Pingen pour les organisations françaises).</p>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Droits</h2>
            <Toggle id="assist" label="Les assistant(e)s peuvent envoyer les documents validés" hint="Sinon, seulement celles et ceux autorisés individuellement (page Utilisateurs)." checked={s.permissions.assistantsCanSend} onChange={(assistantsCanSend) => setS({ ...s, permissions: { ...s.permissions, assistantsCanSend } })} />
            <Toggle id="dir" label="Les audioprothésistes peuvent ajouter et modifier des fiches de l'annuaire" checked={s.permissions.audioprosCanEditDirectory} onChange={(audioprosCanEditDirectory) => setS({ ...s, permissions: { ...s.permissions, audioprosCanEditDirectory } })} />
          </section>
        </>
      )}
      <Button className="h-12 w-full" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Enregistrer
      </Button>
    </div>
  );
}
