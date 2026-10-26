"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, RotateCcw, Save, TriangleAlert, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { FormField } from "@/components/forms/form-field";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { BrandLogo } from "@/components/brand/brand-logo";
import { updateOrganizationAction } from "@/server/actions/admin";
import { contrastRatio, DEFAULT_COLORS, derivePalette } from "@/lib/brand";
import { FONT_CHOICES, type Brand, type BrandColors, type FontChoice } from "@/lib/schemas/organization";

const COLOR_LABELS: Record<keyof BrandColors, string> = {
  primary: "Couleur principale",
  accent: "Couleur d'accent",
  text: "Texte",
  muted: "Traits et texte discret",
  surface: "Fond des encadrés",
  border: "Bordure des encadrés",
  tint: "Pastilles numérotées",
  footerLine: "Trait du pied de page",
};

export function BrandEditor({ initial }: { initial: { name: string; brand: Brand; legal: { companyName: string; mentions: string } } }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [brand, setBrand] = useState<Brand>(initial.brand);
  const [legal, setLegal] = useState(initial.legal);
  const [previewType, setPreviewType] = useState<"ADRESSAGE" | "COMPTE_RENDU">("ADRESSAGE");
  const [pending, start] = useTransition();
  const [body, setBody] = useState(() => JSON.stringify({ brand: initial.brand, type: "ADRESSAGE" }));

  useEffect(() => {
    const t = setTimeout(() => setBody(JSON.stringify({ brand, type: previewType })), 500);
    return () => clearTimeout(t);
  }, [brand, previewType]);
  const request = useMemo(() => ({ method: "POST" as const, url: "/api/admin/apercu-marque", body }), [body]);

  const setColor = (k: keyof BrandColors, v: string) => setBrand((b) => ({ ...b, colors: { ...b.colors, [k]: v.toUpperCase() } }));
  const lowContrast = /^#[0-9A-F]{6}$/i.test(brand.colors.primary) && contrastRatio(brand.colors.primary, "#FFFFFF") < 4.5;

  async function onLogo(file: File) {
    if (file.size > 4 * 1024 * 1024) return void toast.error("Logo trop lourd (4 Mo maximum).");
    const reader = new FileReader();
    reader.onload = () => setBrand((b) => ({ ...b, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  function save() {
    start(async () => {
      const res = await updateOrganizationAction({ name, brand, legal });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Enregistré.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Identité</h2>
          <FormField id="org-name" label="Nom de l'organisation (interne)">
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="brand-name" label="Nom de marque (affiché sur les documents et e-mails)" hint="Les centres s'affichent « Marque — Ville ».">
            <Input id="brand-name" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} />
          </FormField>
          <FormField id="slogan" label="Slogan (en tête des documents)">
            <Input id="slogan" value={brand.slogan} onChange={(e) => setBrand({ ...brand, slogan: e.target.value })} maxLength={80} />
          </FormField>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 min-w-40 items-center justify-center rounded-lg border bg-white px-4">
              <BrandLogo name={brand.name} logo={brand.logo} className="h-12" />
            </div>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-medium shadow-xs hover:bg-muted focus-within:outline-2 pointer-coarse:min-h-11 dark:bg-input/20">
              <ImageUp className="size-4" aria-hidden /> Changer le logo
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
            </label>
            {brand.logo ? (
              <Button variant="ghost" onClick={() => setBrand({ ...brand, logo: null })}>
                Retirer
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Couleurs</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setBrand({ ...brand, colors: derivePalette(brand.colors.primary, brand.colors.accent) })}>
                <Wand2 aria-hidden /> Recalculer les teintes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBrand({ ...brand, colors: { ...DEFAULT_COLORS } })}>
                <RotateCcw aria-hidden /> Thème par défaut
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(COLOR_LABELS) as (keyof BrandColors)[]).map((k) => (
              <div key={k} className="flex items-center gap-3">
                <input type="color" aria-label={COLOR_LABELS[k]} value={brand.colors[k].toLowerCase()} onChange={(e) => setColor(k, e.target.value)} className="size-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-1" />
                <label className="min-w-0 flex-1 text-sm">
                  <span className="block truncate">{COLOR_LABELS[k]}</span>
                  <Input value={brand.colors[k]} onChange={(e) => setColor(k, e.target.value)} className="mt-1 h-9 font-mono" maxLength={7} />
                </label>
              </div>
            ))}
          </div>
          {lowContrast ? (
            <p className="flex items-start gap-2 text-sm text-warning-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> La couleur principale offre un contraste insuffisant avec le blanc (WCAG AA 4,5:1) : le texte des boutons et bandeaux sera difficile à lire.
            </p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Polices</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["heading", "Titres (interface)"],
                ["body", "Texte (interface)"],
                ["document", "Documents PDF"],
              ] as const
            ).map(([k, label]) => (
              <FormField key={k} id={`font-${k}`} label={label}>
                <Select value={brand.fonts[k]} onValueChange={(v) => setBrand({ ...brand, fonts: { ...brand.fonts, [k]: v as FontChoice } })}>
                  <SelectTrigger id={`font-${k}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_CHOICES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Mentions légales</h2>
          <FormField id="company" label="Raison sociale">
            <Input id="company" value={legal.companyName} onChange={(e) => setLegal({ ...legal, companyName: e.target.value })} />
          </FormField>
          <FormField id="mentions" label="Mentions (pied des e-mails)">
            <Textarea id="mentions" value={legal.mentions} onChange={(e) => setLegal({ ...legal, mentions: e.target.value })} rows={3} maxLength={1000} />
          </FormField>
        </section>

        <Button className="h-12 w-full" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Enregistrer la marque
        </Button>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <SegmentedControl value={previewType} onValueChange={setPreviewType} aria-label="Document d'aperçu">
          <SegmentedControlItem value="ADRESSAGE">Courrier d&apos;adressage</SegmentedControlItem>
          <SegmentedControlItem value="COMPTE_RENDU">Compte rendu</SegmentedControlItem>
        </SegmentedControl>
        <PdfPreview request={request} label="Aperçu de la marque" />
      </aside>
    </div>
  );
}
