"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceGroup } from "@/components/forms/choice-group";
import { DictationButton } from "@/components/forms/dictation-button";
import { AiBadge } from "@/components/documents/ai-badge";
import type { CompteRenduData } from "@/lib/schemas/document";
import { docFr } from "@/lib/i18n/documents";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";
import { EditorSection, FieldLabelRow } from "./section";
import { RecipientFields } from "./recipient-section";
import { useDictation } from "./use-dictation";

const F = docFr.fields;
const O = docFr.options;

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  signia: ["Pure Charge&Go IX 7", "Pure Charge&Go IX 5", "Styletto IX 7", "Insio Charge&Go IX", "Motion Charge&Go IX", "Silk Charge&Go IX"],
  starkey: ["Genesis AI 24", "Genesis AI 20", "Edge AI 24", "Edge AI 20", "Signature Series"],
  resound: ["Nexia 9", "Nexia 7", "Vivia 9", "Omnia 9", "Key 4"],
  autre: [],
};

function opts<K extends string>(map: Record<K, string>) {
  return (Object.entries(map) as [K, string][]).map(([value, label]) => ({ value, label }));
}

export function CompteRenduFields({ bilan, commentAssistant, previewWarning }: { bilan?: ReactNode; commentAssistant?: ReactNode; previewWarning?: ReactNode }) {
  const ed = useEditor<CompteRenduData>();
  const d = ed.data;
  const ro = ed.readOnly;
  const ai = (k: keyof CompteRenduData) => (ed.aiFields.includes(k) ? <AiBadge onAccept={() => ed.acceptAi(k)} /> : null);
  const dictation = useDictation("comments");
  const aiCls = (k: keyof CompteRenduData) => (ed.aiFields.includes(k) ? "rounded-lg ring-2 ring-ai-foreground/30 ring-offset-2 ring-offset-card" : "");

  return (
    <div className="space-y-5">
      <EditorSection title={docFr.sections.identity} id="sec-identity">
        <RecipientFields />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabelRow htmlFor="reportDate" label={F.reportDate} required error={ed.errors.reportDate} />
            <Input id="reportDate" type="date" value={d.reportDate} disabled={ro} onChange={(e) => ed.update({ reportDate: e.target.value })} />
          </div>
          <div>
            <FieldLabelRow htmlFor="prescriptionDate" label={F.prescriptionDate} />
            <Input id="prescriptionDate" type="date" value={d.prescriptionDate ?? ""} disabled={ro} onChange={(e) => ed.update({ prescriptionDate: e.target.value })} />
          </div>
        </div>
      </EditorSection>

      {bilan}

      <EditorSection title={docFr.sections.patientInfo} id="sec-patient">
        <div className={aiCls("degree")}>
          <FieldLabelRow htmlFor="degree" group label={F.degree} required error={ed.errors.degree} badge={ai("degree")} />
          <ChoiceGroup id="degree" label={F.degree} value={d.degree} onChange={(v) => !ro && ed.update({ degree: v })} options={opts(O.degree)} invalid={Boolean(ed.errors.degree)} />
          {d.degreeRule && ed.aiFields.includes("degree") ? (
            <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {d.degreeRule}
            </p>
          ) : null}
        </div>
        <div className={aiCls("ears")}>
          <FieldLabelRow htmlFor="ears" group label={F.ears} required error={ed.errors.ears} badge={ai("ears")} />
          <ChoiceGroup id="ears" label={F.ears} value={d.ears} onChange={(v) => !ro && ed.update({ ears: v })} options={opts(O.ears)} invalid={Boolean(ed.errors.ears)} />
        </div>
      </EditorSection>

      <EditorSection title={docFr.sections.device} id="sec-device">
        <div>
          <FieldLabelRow htmlFor="deviceType" group label={F.deviceType} required error={ed.errors.deviceType} />
          <ChoiceGroup
            id="deviceType"
            label={F.deviceType}
            value={d.deviceType}
            onChange={(v) => !ro && ed.update({ deviceType: v })}
            options={opts(O.deviceType).map((o, i) => ({ ...o, label: `${i + 1}. ${o.label}` }))}
            invalid={Boolean(ed.errors.deviceType)}
            columns={3}
          />
        </div>
        <div>
          <FieldLabelRow htmlFor="deviceBrand" group label={F.deviceBrand} required error={ed.errors.deviceBrand ?? ed.errors.deviceBrandOther} />
          <ChoiceGroup id="deviceBrand" label={F.deviceBrand} value={d.deviceBrand} onChange={(v) => !ro && ed.update({ deviceBrand: v })} options={opts(O.deviceBrand)} invalid={Boolean(ed.errors.deviceBrand)} columns={4} />
          {d.deviceBrand === "autre" ? (
            <Input
              aria-label={F.deviceBrandOther}
              placeholder="Précisez la marque (ex. Phonak, Oticon, Widex…)"
              value={d.deviceBrandOther}
              disabled={ro}
              onChange={(e) => ed.update({ deviceBrandOther: e.target.value })}
              className="mt-2"
              maxLength={40}
            />
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div>
            <FieldLabelRow htmlFor="deviceModel" label={F.deviceModel} />
            <Input id="deviceModel" list="model-suggestions" value={d.deviceModel} disabled={ro} onChange={(e) => ed.update({ deviceModel: e.target.value })} maxLength={80} />
            <datalist id="model-suggestions">
              {(MODEL_SUGGESTIONS[d.deviceBrand ?? ""] ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabelRow htmlFor="price" label={F.pricePerDevice} />
            <Input
              id="price"
              inputMode="decimal"
              value={d.pricePerDevice === null ? "" : String(d.pricePerDevice).replace(".", ",")}
              disabled={ro}
              onChange={(e) => {
                const raw = e.target.value.replace(/\s|€/g, "").replace(",", ".");
                if (raw === "") return ed.update({ pricePerDevice: null });
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 0 && n <= 100000) ed.update({ pricePerDevice: Math.round(n * 100) / 100 });
              }}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabelRow htmlFor="deviceClass" group label={F.deviceClass} required error={ed.errors.deviceClass} />
            <ChoiceGroup id="deviceClass" label={F.deviceClass} value={d.deviceClass} onChange={(v) => !ro && ed.update({ deviceClass: v })} options={[{ value: "cmu", label: "CMU" }, { value: "1", label: "1" }, { value: "2", label: "2" }]} invalid={Boolean(ed.errors.deviceClass)} />
          </div>
          <div>
            <FieldLabelRow htmlFor="rechargeable" group label={F.rechargeable} />
            <ChoiceGroup id="rechargeable" label={F.rechargeable} value={d.rechargeable} onChange={(v) => !ro && ed.update({ rechargeable: v })} options={[{ value: true, label: "Oui" }, { value: false, label: "Non" }]} />
          </div>
          <div>
            <FieldLabelRow htmlFor="customEarmolds" group label={F.customEarmolds} />
            <ChoiceGroup id="customEarmolds" label={F.customEarmolds} value={d.customEarmolds} onChange={(v) => !ro && ed.update({ customEarmolds: v })} options={[{ value: true, label: "Oui" }, { value: false, label: "Non" }]} />
          </div>
        </div>
      </EditorSection>

      <EditorSection title={docFr.sections.results} id="sec-results">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div>
            <FieldLabelRow htmlFor="wearDuration" label={F.wearDuration} />
            <Input id="wearDuration" list="wear-suggestions" value={d.wearDuration} disabled={ro} onChange={(e) => ed.update({ wearDuration: e.target.value })} maxLength={40} placeholder="ex. 3 semaines" />
            <datalist id="wear-suggestions">
              {docFr.wearDurationSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabelRow htmlFor="hours" label={F.wearHoursPerDay} />
            <div className="flex items-center gap-2">
              <Input
                id="hours"
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.5}
                value={d.wearHoursPerDay ?? ""}
                disabled={ro}
                onChange={(e) => ed.update({ wearHoursPerDay: e.target.value === "" ? null : Math.max(0, Math.min(24, Number(e.target.value))) })}
              />
              <span className="text-sm text-muted-foreground">h/jour</span>
            </div>
          </div>
        </div>
        <div>
          <FieldLabelRow htmlFor="motivation" group label={F.motivation} />
          <ChoiceGroup id="motivation" label={F.motivation} value={d.motivation} onChange={(v) => !ro && ed.update({ motivation: v })} options={opts(O.motivation)} />
        </div>
        <div>
          <FieldLabelRow htmlFor="handling" group label={F.handling} />
          <ChoiceGroup id="handling" label={F.handling} value={d.handling} onChange={(v) => !ro && ed.update({ handling: v })} options={opts(O.handling)} />
        </div>
      </EditorSection>

      <EditorSection title={docFr.sections.comments} id="sec-comments" aside={!ro && ed.shared.dictationEnabled ? <DictationButton onText={dictation.onText} onEnd={() => void dictation.onEnd()} label={dictation.cleaning ? "Nettoyage…" : "Dicter"} /> : null}>
        <div className={aiCls("comments")}>
          <FieldLabelRow htmlFor="comments" label={F.comments} badge={ai("comments")} />
          <Textarea
            id="comments"
            value={d.comments}
            disabled={ro}
            rows={7}
            maxLength={2500}
            placeholder={F.commentsPlaceholder}
            onChange={(e) => ed.update({ comments: e.target.value })}
            className={cn(ed.aiFields.includes("comments") && "bg-ai/30")}
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{d.comments.length}/2500 caractères</span>
          </div>
        </div>
        {previewWarning}
        {commentAssistant}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <Checkbox checked={d.includeAnnex} disabled={ro} onCheckedChange={(v) => ed.update({ includeAnnex: v === true })} className="mt-0.5" />
          {F.includeAnnex}
        </label>
      </EditorSection>
    </div>
  );
}
