"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ChevronDown, Plus } from "lucide-react";
import { prescriberInputSchema, SPECIALTIES, type PrescriberInput } from "@/lib/schemas/prescriber";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import { FormField, RequiredLegend, fieldAria } from "@/components/forms/form-field";
import { ChoiceField, FormSection, submitOnModEnter } from "@/components/directory/form-parts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Shortcut } from "@/components/ui/shortcut";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { channelReadiness } from "./format";
import { SendReadiness } from "./send-readiness";

type FormInput = z.input<typeof prescriberInputSchema>;
const L = dirFr.prescribers.fields;
const S = dirFr.prescribers.sections;

export const EMPTY_PRESCRIBER: FormInput = {
  civility: "Dr",
  lastName: "",
  firstName: "",
  specialty: "ORL",
  rpps: "",
  practiceName: "",
  address: { line1: "", line2: "", postalCode: "", city: "", country: "FRANCE" },
  email: "",
  phone: "",
  preferredChannel: "email",
  salutation: "",
  notes: "",
  centreIds: [],
};

const CIVILITIES = (["Dr", "Pr", "Mme", "M."] as const).map((c) => ({ value: c, label: c }));
const CHANNELS = (["email", "courrier", "both"] as const).map((c) => ({ value: c, label: fr.preferredChannel[c] }));
const OTHER = "Autre";
const KNOWN_SPECIALTIES: readonly string[] = SPECIALTIES.filter((s) => s !== OTHER);

/**
 * Fiche prescripteur en sections (Identité, Coordonnées, Adresse postale, Préférences d'envoi)
 * avec un bloc « Plus d'informations » replié. En mode `compact` (création rapide depuis un
 * document), seuls l'identité, l'e-mail et l'adresse restent visibles. Un indicateur d'envoi
 * se met à jour pendant la saisie. Ctrl/⌘ + Entrée enregistre.
 */
export function PrescriberForm({
  defaultValues,
  centres,
  salutations,
  submitLabel,
  onSubmit,
  onCancel,
  compact,
}: {
  defaultValues?: Partial<FormInput>;
  centres: { id: string; name: string }[];
  salutations: string[];
  submitLabel: string;
  onSubmit: (values: PrescriberInput) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const form = useForm<FormInput, unknown, PrescriberInput>({
    resolver: zodResolver(prescriberInputSchema),
    mode: "onTouched",
    defaultValues: { ...EMPTY_PRESCRIBER, ...defaultValues, address: { ...EMPTY_PRESCRIBER.address, ...defaultValues?.address } },
  });
  const { register, control, handleSubmit, formState, setValue } = form;
  const e = formState.errors;
  const [email, address, preferredChannel] = useWatch({ control, name: ["email", "address", "preferredChannel"] });
  const readiness = channelReadiness({
    email: email ?? "",
    address: {
      line1: address?.line1 ?? "",
      line2: address?.line2 ?? "",
      postalCode: address?.postalCode ?? "",
      city: address?.city ?? "",
      country: address?.country ?? "",
    },
    preferredChannel: preferredChannel ?? "email",
  });

  const initial = { ...EMPTY_PRESCRIBER, ...defaultValues };
  const [showLine2, setShowLine2] = useState(Boolean(defaultValues?.address?.line2));
  const [moreOpen, setMoreOpen] = useState(
    () => !compact && Boolean(initial.rpps || initial.notes || (initial.centreIds?.length ?? 0) > 0),
  );
  const moreHasError = compact
    ? Boolean(e.phone || e.rpps || e.specialty || e.salutation || e.address?.line2 || e.address?.country || e.notes)
    : Boolean(e.rpps || e.notes);
  const autoFocusFirstName = Boolean(initial.lastName) && !initial.firstName;

  const civility = (
    <Controller
      control={control}
      name="civility"
      render={({ field }) => (
        <ChoiceField id="p-civility" label={L.civility} value={field.value ?? "Dr"} onChange={field.onChange} options={CIVILITIES} className="sm:max-w-xs" />
      )}
    />
  );

  const specialty = (
    <Controller
      control={control}
      name="specialty"
      render={({ field }) => {
        const value = field.value ?? "";
        const isOther = !KNOWN_SPECIALTIES.includes(value);
        return (
          <div className="min-w-0 space-y-1.5">
            <span id="p-specialty-label" className="flex min-h-5 items-center text-sm leading-5 font-medium">
              {L.specialty}
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-labelledby="p-specialty-label"
              value={isOther ? OTHER : value}
              onValueChange={(v) => {
                if (!v) return;
                field.onChange(v === OTHER ? (isOther ? value : "") : v);
              }}
              className="flex-wrap"
            >
              {SPECIALTIES.map((s) => (
                <ToggleGroupItem key={s} value={s} className="rounded-full">
                  {s}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {isOther ? (
              <Input
                id="p-specialty"
                aria-label={dirFr.prescribers.otherSpecialty}
                placeholder={dirFr.prescribers.otherSpecialty}
                value={value === OTHER ? "" : value}
                onChange={(ev) => field.onChange(ev.target.value)}
                onBlur={field.onBlur}
                className="mt-2 sm:max-w-xs"
                maxLength={80}
              />
            ) : null}
          </div>
        );
      }}
    />
  );

  const practice = (
    <FormField id="p-practice" label={L.practiceName}>
      <Input {...register("practiceName")} id="p-practice" autoComplete="off" />
    </FormField>
  );

  const emailField = (
    <FormField id="p-email" label={L.email} error={e.email?.message}>
      <Input {...register("email")} {...fieldAria("p-email", e.email?.message)} type="email" inputMode="email" autoComplete="off" />
    </FormField>
  );

  const phoneField = (
    <FormField id="p-phone" label={L.phone} error={e.phone?.message}>
      <Input {...register("phone")} {...fieldAria("p-phone", e.phone?.message)} type="tel" inputMode="tel" autoComplete="off" />
    </FormField>
  );

  const line2Field = (
    <FormField id="p-line2" label={L.line2}>
      <Input {...register("address.line2")} id="p-line2" autoComplete="off" />
    </FormField>
  );

  const countryField = (
    <FormField id="p-country" label={L.country}>
      <Input {...register("address.country")} id="p-country" autoComplete="off" />
    </FormField>
  );

  const channel = (
    <Controller
      control={control}
      name="preferredChannel"
      render={({ field }) => (
        <ChoiceField
          id="p-channel"
          label={L.preferredChannel}
          value={field.value ?? "email"}
          onChange={field.onChange}
          options={CHANNELS}
          columns={{ base: 1, sm: 3 }}
        />
      )}
    />
  );

  const salutationField = (
    <Controller
      control={control}
      name="salutation"
      render={({ field }) => (
        <FormField id="p-salutation" label={L.salutation} hint={dirFr.prescribers.salutationHint}>
          <Input {...field} value={field.value ?? ""} id="p-salutation" aria-describedby="p-salutation-hint" maxLength={60} autoComplete="off" />
          {salutations.length > 0 ? (
            <div role="group" aria-label={dirFr.prescribers.salutationSuggestions} className="flex flex-wrap gap-1.5 pt-1">
              {salutations.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-pressed={field.value === s}
                  onClick={() => setValue("salutation", field.value === s ? "" : s, { shouldDirty: true })}
                  className="rounded-full font-normal aria-pressed:border-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                >
                  {s}
                </Button>
              ))}
            </div>
          ) : null}
        </FormField>
      )}
    />
  );

  const rppsField = (
    <FormField id="p-rpps" label={L.rpps} error={e.rpps?.message} hint={fr.common.optional}>
      <Input {...register("rpps")} {...fieldAria("p-rpps", e.rpps?.message, { hint: true })} inputMode="numeric" maxLength={11} className="sm:w-48" />
    </FormField>
  );

  const notesField = (
    <FormField id="p-notes" label={L.notes}>
      <Textarea {...register("notes")} id="p-notes" rows={3} />
    </FormField>
  );

  const centresField =
    centres.length > 1 ? (
      <fieldset className="min-w-0 space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">{L.centres}</legend>
        <Controller
          control={control}
          name="centreIds"
          render={({ field }) => {
            const value = field.value ?? [];
            return (
              <div className="grid gap-2 sm:grid-cols-2">
                {centres.map((c) => (
                  <label
                    key={c.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 text-sm transition-colors hover:bg-muted/50 has-data-[state=checked]:border-ring has-data-[state=checked]:bg-accent"
                  >
                    <Checkbox
                      checked={value.includes(c.id)}
                      onCheckedChange={(checked) => field.onChange(checked ? [...value, c.id] : value.filter((v) => v !== c.id))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            );
          }}
        />
      </fieldset>
    ) : null;

  const readinessBlock = (
    <SendReadiness readiness={readiness} onSwitch={(c) => setValue("preferredChannel", c, { shouldDirty: true })} />
  );

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit({ ...v, specialty: v.specialty || OTHER }))}
      onKeyDown={submitOnModEnter}
      className="space-y-6"
      noValidate
    >
      <FormSection title={S.identity}>
        {civility}
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <FormField id="p-lastName" label={L.lastName} required error={e.lastName?.message}>
            <Input
              {...register("lastName")}
              {...fieldAria("p-lastName", e.lastName?.message, { required: true })}
              autoComplete="off"
              autoFocus={!autoFocusFirstName}
            />
          </FormField>
          <FormField id="p-firstName" label={L.firstName}>
            <Input {...register("firstName")} id="p-firstName" autoComplete="off" autoFocus={autoFocusFirstName} />
          </FormField>
        </div>
        {compact ? null : specialty}
        {practice}
      </FormSection>

      <FormSection title={S.contact}>
        {compact ? (
          emailField
        ) : (
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {emailField}
            {phoneField}
          </div>
        )}
      </FormSection>

      <FormSection title={S.address}>
        <FormField id="p-line1" label={L.line1}>
          <Input {...register("address.line1")} id="p-line1" autoComplete="off" />
        </FormField>
        {compact ? null : showLine2 ? (
          line2Field
        ) : (
          <Button type="button" variant="link" size="sm" className="-mt-2 h-auto px-0" onClick={() => setShowLine2(true)}>
            <Plus aria-hidden /> {dirFr.prescribers.addLine2}
          </Button>
        )}
        <div className={cn("grid gap-x-4 gap-y-5", compact ? "grid-cols-[7rem_minmax(0,1fr)]" : "grid-cols-[7rem_minmax(0,1fr)] sm:grid-cols-[7rem_minmax(0,1fr)_9rem]")}>
          <FormField id="p-cp" label={L.postalCode}>
            <Input {...register("address.postalCode")} id="p-cp" inputMode="numeric" maxLength={10} autoComplete="off" />
          </FormField>
          <FormField id="p-city" label={L.city}>
            <Input {...register("address.city")} id="p-city" autoComplete="off" />
          </FormField>
          {compact ? null : <div className="col-span-2 sm:col-span-1">{countryField}</div>}
        </div>
        {compact ? readinessBlock : null}
      </FormSection>

      {compact ? null : (
        <FormSection title={S.preferences}>
          {channel}
          {readinessBlock}
          {salutationField}
        </FormSection>
      )}

      <Collapsible open={moreOpen || moreHasError} onOpenChange={setMoreOpen} className="border-t pt-3">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="group/more -mx-2 w-[calc(100%+1rem)] justify-between px-2 font-semibold">
            {compact ? S.moreCompact : S.more}
            <ChevronDown className="transition-transform duration-150 group-data-[state=open]/more:rotate-180" aria-hidden />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent forceMount className="space-y-5 pt-3 data-[state=closed]:hidden">
          {compact ? (
            <>
              {specialty}
              {phoneField}
              {line2Field}
              {countryField}
              {channel}
              {salutationField}
            </>
          ) : null}
          {rppsField}
          {notesField}
          {centresField}
        </CollapsibleContent>
      </Collapsible>

      <RequiredLegend />

      <DialogFooter>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {fr.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner /> : null}
          {submitLabel}
          <Shortcut keys={["mod", "enter"]} className="max-sm:hidden" />
        </Button>
      </DialogFooter>
    </form>
  );
}
