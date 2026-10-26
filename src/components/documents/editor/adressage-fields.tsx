"use client";

import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DictationButton } from "@/components/forms/dictation-button";
import { AiBadge } from "@/components/documents/ai-badge";
import type { AdressageData } from "@/lib/schemas/document";
import { docFr } from "@/lib/i18n/documents";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";
import { EditorSection, FieldLabelRow } from "./section";
import { RecipientFields } from "./recipient-section";
import { useDictation } from "./use-dictation";
import type { ReactNode } from "react";

const F = docFr.fields;
const DEFAULT_SALUTATION = "__defaut__";

export function AdressageFields({ motifAssistant }: { motifAssistant?: ReactNode }) {
  const ed = useEditor<AdressageData>();
  const d = ed.data;
  const ro = ed.readOnly;
  const exams = [
    { key: "conduits" as const, label: F.conduits },
    { key: "bilan" as const, label: F.bilan },
    { key: "autre" as const, label: F.autre },
  ];
  const dictation = useDictation("autreText");
  const effectiveSalutation = ed.prescriber?.salutation || ed.shared.defaultSalutation;

  return (
    <div className="space-y-5">
      <EditorSection title={docFr.sections.recipient} id="sec-recipient">
        <RecipientFields />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabelRow htmlFor="salutation" label={F.salutation} />
            <Select
              value={d.salutation || DEFAULT_SALUTATION}
              onValueChange={(v) => ed.update({ salutation: v === DEFAULT_SALUTATION ? "" : v })}
              disabled={ro}
            >
              <SelectTrigger id="salutation" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_SALUTATION}>{F.salutationDefault(effectiveSalutation)}</SelectItem>
                {ed.shared.salutations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabelRow htmlFor="date" label={F.date} required error={ed.errors.date} />
            <Input id="date" type="date" value={d.date} disabled={ro} onChange={(e) => ed.update({ date: e.target.value })} />
          </div>
        </div>
      </EditorSection>

      <EditorSection title={docFr.sections.exams} id="sec-exams">
        {ed.errors.exams ? (
          <p role="alert" className="text-sm text-destructive">
            {ed.errors.exams}
          </p>
        ) : null}
        <div className="grid gap-2" role="group" aria-label={docFr.sections.exams}>
          {exams.map((x) => {
            const checked = d.exams[x.key];
            return (
              <button
                key={x.key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={ro}
                data-testid={`exam-${x.key}`}
                onClick={() => ed.update({ exams: { ...d.exams, [x.key]: !checked } })}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg border px-4 text-left text-sm font-medium transition-colors disabled:opacity-70",
                  checked ? "border-primary bg-accent" : "bg-card hover:bg-accent",
                )}
              >
                <span className={cn("flex size-5 items-center justify-center rounded border-2", checked ? "border-primary bg-primary text-primary-foreground" : "border-primary/70")}>
                  {checked ? <Check className="size-3.5" aria-hidden /> : null}
                </span>
                {x.label}
              </button>
            );
          })}
        </div>
        {d.exams.autre ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabelRow htmlFor="autreText" label={F.autreText} required error={ed.errors.autreText} badge={ed.aiFields.includes("autreText") ? <AiBadge onAccept={() => ed.acceptAi("autreText")} /> : null} />
              {!ro && ed.shared.dictationEnabled ? (
                <DictationButton onText={dictation.onText} onEnd={() => void dictation.onEnd()} label={dictation.cleaning ? "Nettoyage…" : "Dicter"} />
              ) : null}
            </div>
            <Textarea
              id="autreText"
              value={d.autreText}
              disabled={ro}
              rows={4}
              maxLength={600}
              placeholder={F.autrePlaceholder}
              onChange={(e) => ed.update({ autreText: e.target.value })}
              className={cn(ed.aiFields.includes("autreText") && "border-ai-foreground/40 bg-ai/40")}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{d.autreText.length}/600 caractères</span>
              {motifAssistant}
            </div>
          </div>
        ) : null}
      </EditorSection>
    </div>
  );
}
