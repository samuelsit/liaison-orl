"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatIsoDate } from "@/lib/dates";
import { formatPersonName } from "@/lib/text";
import { searchPatientsAction } from "@/server/actions/patients";
import type { PatientView } from "@/server/services/patients";
import type { PrescriberView } from "@/server/services/prescribers";
import { PatientDialog } from "./patient-dialog";

export function PatientCombobox({
  id,
  value,
  onChange,
  centres,
  activeCentreId,
  salutations,
  invalid,
  disabled,
}: {
  id: string;
  value: PatientView | null;
  onChange: (p: PatientView | null, prescriber?: PrescriberView | null) => void;
  centres: { id: string; name: string }[];
  activeCentreId: string;
  salutations: string[];
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PatientView[]>([]);
  /** Patients des autres centres de l'utilisateur (même annuaire) : proposés quand on cherche. */
  const [others, setOthers] = useState<PatientView[]>([]);
  const centreName = (id: string) => centres.find((c) => c.id === id)?.name ?? "";
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPatientsAction(query);
        if (cancelled) return;
        setItems(res);
        setHighlight(res[0]?.id ?? "__create__");
        // Un patient créé depuis un autre centre reste trouvable : l'annuaire est commun à tous les documents.
        if (query.trim() && centres.length > 1) {
          const all = await searchPatientsAction(query, "all");
          if (!cancelled) {
            const extra = all.filter((p) => !res.some((r) => r.id === p.id));
            setOthers(extra);
            if (!res.length && extra[0]) setHighlight(extra[0].id);
          }
        } else if (!cancelled) setOthers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 150 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, centres.length]);

  const words = query.trim().split(/\s+/);
  const prefill = words.length > 1 ? { lastName: words.slice(0, -1).join(" "), firstName: words.at(-1) } : { lastName: query.trim() };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn("h-auto min-h-9 w-full min-w-0 justify-between overflow-hidden px-3 py-1.5 text-left font-normal hover:border-foreground/25 hover:bg-card pointer-coarse:min-h-11", invalid && "border-destructive")}
            data-testid="patient-combobox"
          >
            {value ? (
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {value.civility} {formatPersonName(value.firstName, value.lastName)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{value.birthDate ? `Né(e) le ${formatIsoDate(value.birthDate)}` : "Date de naissance non renseignée"}</span>
              </span>
            ) : (
              <span className="truncate text-muted-foreground">Rechercher ou créer un patient…</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-80 p-0" align="start">
          <Command shouldFilter={false} value={highlight} onValueChange={setHighlight}>
            <CommandInput placeholder="Nom, prénom ou date de naissance…" value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && items.length === 0 ? (
                <div className="flex justify-center p-4">
                  <Spinner />
                </div>
              ) : null}
              <CommandEmpty>Aucun patient trouvé dans ce centre.</CommandEmpty>
              {!loading && query.trim() && !items.length && !others.length ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aucun patient trouvé dans vos centres.</p>
              ) : null}
              {items.length ? (
                <CommandGroup heading={query ? "Résultats" : "Patients récents du centre"}>
                  {items.map((p) => (
                    <PatientItem key={p.id} p={p} selected={value?.id === p.id} onSelect={() => (onChange(p), setOpen(false), setQuery(""))} />
                  ))}
                </CommandGroup>
              ) : null}
              {others.length ? (
                <CommandGroup heading="Dans vos autres centres">
                  {others.map((p) => (
                    <PatientItem key={p.id} p={p} selected={value?.id === p.id} centre={centreName(p.centreId)} onSelect={() => (onChange(p), setOpen(false), setQuery(""))} />
                  ))}
                </CommandGroup>
              ) : null}
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateKey((k) => k + 1);
                    setCreateOpen(true);
                  }}
                >
                  <Plus aria-hidden /> {query ? `Créer « ${query} »` : "Nouveau patient"}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <PatientDialog
        key={createKey}
        open={createOpen}
        onOpenChange={setCreateOpen}
        centres={centres}
        activeCentreId={activeCentreId}
        salutations={salutations}
        prefill={prefill}
        showPrescriber={false}
        onSaved={(p) => {
          onChange(p);
          setQuery("");
        }}
      />
    </>
  );
}

/** Ligne de patient dans la liste : identité, date de naissance et, pour un autre centre, le nom du centre. */
function PatientItem({ p, selected, centre, onSelect }: { p: PatientView; selected: boolean; centre?: string; onSelect: () => void }) {
  return (
    <CommandItem value={p.id} onSelect={onSelect}>
      <Check className={cn(selected ? "opacity-100" : "opacity-0")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {p.civility} {formatPersonName(p.firstName, p.lastName)}
        </span>
        <span className="block text-xs text-muted-foreground">
          {p.birthDate ? formatIsoDate(p.birthDate) : "—"}
          {centre ? ` · ${centre}` : ""}
        </span>
      </span>
    </CommandItem>
  );
}
