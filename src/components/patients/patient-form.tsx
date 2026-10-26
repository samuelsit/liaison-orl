"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown } from "lucide-react";
import { FormField, RequiredLegend, fieldAria } from "@/components/forms/form-field";
import { DateInput } from "@/components/forms/date-input";
import { ChoiceField, submitOnModEnter } from "@/components/directory/form-parts";
import { DOCUMENT_ICON } from "@/components/directory/create-document-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shortcut } from "@/components/ui/shortcut";
import { Spinner } from "@/components/ui/spinner";
import { PrescriberCombobox } from "@/components/prescribers/prescriber-combobox";
import { civilitySchema, isoDateSchema } from "@/lib/schemas/common";
import type { DocumentType } from "@/lib/schemas/document";
import type { PrescriberView } from "@/server/services/prescribers";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";

const formSchema = z.object({
  civility: civilitySchema,
  lastName: z.string().trim().min(1, "Nom obligatoire").max(80),
  firstName: z.string().trim().min(1, "Prénom obligatoire").max(80),
  birthDate: z.union([isoDateSchema, z.literal("")]),
  centreId: z.string().min(1),
});
export type PatientFormValues = z.infer<typeof formSchema> & { usualPrescriberId: string | null };
const L = dirFr.patients.fields;
const T = dirFr.patients;
const CIVILITIES = (["Mme", "M."] as const).map((c) => ({ value: c, label: c }));

/**
 * Fiche patient minimale : civilité, nom, prénom, date de naissance, centre et prescripteur
 * habituel. Ctrl/⌘ + Entrée enregistre. Avec `documentIntents`, le bouton de création propose
 * aussi « Créer et rédiger un adressage / un compte rendu » (menu attaché).
 */
export function PatientForm({
  defaultValues,
  defaultPrescriber,
  centres,
  salutations,
  submitLabel,
  onSubmit,
  onCancel,
  showPrescriber = true,
  documentIntents = false,
}: {
  defaultValues: Partial<z.infer<typeof formSchema>>;
  defaultPrescriber?: PrescriberView | null;
  centres: { id: string; name: string }[];
  salutations: string[];
  submitLabel: string;
  onSubmit: (values: PatientFormValues, intent?: DocumentType) => Promise<void>;
  onCancel?: () => void;
  showPrescriber?: boolean;
  documentIntents?: boolean;
}) {
  const [prescriber, setPrescriber] = useState<PrescriberView | null>(defaultPrescriber ?? null);
  const [dateInvalid, setDateInvalid] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const intent = useRef<DocumentType | undefined>(undefined);
  const { register, control, handleSubmit, formState } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: { civility: "Mme", lastName: "", firstName: "", birthDate: "", ...defaultValues },
  });
  const e = formState.errors;
  // Focus sur le premier champ vide (le nom vient souvent de la recherche).
  const focus = !defaultValues.lastName ? "lastName" : !defaultValues.firstName ? "firstName" : defaultValues.birthDate ? "lastName" : "birthDate";

  function submitWith(next: DocumentType) {
    intent.current = next;
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onKeyDown={submitOnModEnter}
      onSubmit={handleSubmit(async (v) => {
        const next = intent.current;
        intent.current = undefined;
        if (dateInvalid) return;
        await onSubmit({ ...v, usualPrescriberId: prescriber?.id ?? null }, next);
      })}
    >
      <Controller
        control={control}
        name="civility"
        render={({ field }) => (
          <ChoiceField id="pt-civility" label={L.civility} value={field.value} onChange={field.onChange} options={CIVILITIES} className="sm:max-w-56" />
        )}
      />
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <FormField id="pt-lastName" label={L.lastName} required error={e.lastName?.message}>
          <Input
            {...register("lastName")}
            {...fieldAria("pt-lastName", e.lastName?.message, { required: true })}
            autoComplete="off"
            autoFocus={focus === "lastName"}
          />
        </FormField>
        <FormField id="pt-firstName" label={L.firstName} required error={e.firstName?.message}>
          <Input
            {...register("firstName")}
            {...fieldAria("pt-firstName", e.firstName?.message, { required: true })}
            autoComplete="off"
            autoFocus={focus === "firstName"}
          />
        </FormField>
      </div>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <FormField id="pt-birth" label={L.birthDate} error={dateInvalid ? T.invalidDate : e.birthDate?.message} hint={T.birthDateHint}>
          <Controller
            control={control}
            name="birthDate"
            render={({ field }) => (
              <DateInput
                id="pt-birth"
                value={field.value}
                onChange={field.onChange}
                onValidityChange={setDateInvalid}
                aria-describedby={dateInvalid || e.birthDate ? "pt-birth-error" : "pt-birth-hint"}
                aria-invalid={dateInvalid || Boolean(e.birthDate) || undefined}
                autoFocus={focus === "birthDate"}
              />
            )}
          />
        </FormField>
        {centres.length > 1 ? (
          <FormField id="pt-centre" label={L.centre}>
            <Controller
              control={control}
              name="centreId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="pt-centre">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {centres.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        ) : null}
      </div>
      {showPrescriber ? (
        <FormField id="pt-prescriber" label={L.usualPrescriber}>
          <PrescriberCombobox id="pt-prescriber" value={prescriber} onChange={setPrescriber} centres={centres} salutations={salutations} canCreate />
        </FormField>
      ) : null}
      <RequiredLegend />
      <DialogFooter>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {fr.common.cancel}
          </Button>
        ) : null}
        {documentIntents ? (
          <ButtonGroup className="max-sm:w-full">
            <Button type="submit" disabled={formState.isSubmitting} className="max-sm:flex-1" onClick={() => (intent.current = undefined)}>
              {formState.isSubmitting ? <Spinner /> : null}
              {submitLabel}
              <Shortcut keys={["mod", "enter"]} className="max-sm:hidden" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" disabled={formState.isSubmitting} aria-label={T.createMore} className="border-l border-primary-foreground/25">
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-64">
                {(["ADRESSAGE", "COMPTE_RENDU"] as const).map((type) => {
                  const Icon = DOCUMENT_ICON[type];
                  return (
                    <DropdownMenuItem key={type} onSelect={() => submitWith(type)}>
                      <Icon aria-hidden />
                      {type === "ADRESSAGE" ? T.createThenAdressage : T.createThenCompteRendu}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        ) : (
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Spinner /> : null}
            {submitLabel}
            <Shortcut keys={["mod", "enter"]} className="max-sm:hidden" />
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}
