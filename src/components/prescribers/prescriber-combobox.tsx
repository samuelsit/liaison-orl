"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, History, Plus, Star, TriangleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { suggestPrescribersAction } from "@/server/actions/prescribers";
import type { PrescriberView } from "@/server/services/prescribers";
import { PrescriberDialog } from "./prescriber-dialog";
import { formatPrescriberName, prescriberWarnings } from "./format";

export function PrescriberCombobox({
  id,
  value,
  onChange,
  centres,
  salutations,
  canCreate,
  invalid,
  disabled,
}: {
  id: string;
  value: PrescriberView | null;
  onChange: (p: PrescriberView | null) => void;
  centres: { id: string; name: string }[];
  salutations: string[];
  canCreate: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PrescriberView[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await suggestPrescribersAction(query);
        if (!cancelled) {
          setItems(res);
          setHighlight(res[0]?.id ?? "__create__");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 150 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  const warnings = value ? prescriberWarnings(value) : null;

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
            data-testid="prescriber-combobox"
          >
            {value ? (
              <span className="min-w-0">
                <span className="block truncate font-medium">{formatPrescriberName(value)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[value.practiceName, value.address.city].filter(Boolean).join(" · ")}
                </span>
              </span>
            ) : (
              <span className="truncate text-muted-foreground">Rechercher un ORL ou un médecin…</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-80 p-0" align="start">
          <Command shouldFilter={false} value={highlight} onValueChange={setHighlight}>
            <CommandInput placeholder="Nom, ville, cabinet…" value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && items.length === 0 ? (
                <div className="flex justify-center p-4">
                  <Spinner />
                </div>
              ) : null}
              <CommandEmpty>Aucun prescripteur trouvé.</CommandEmpty>
              {items.length ? (
                <CommandGroup heading={query ? "Résultats" : "Favoris, récents et prescripteurs du centre"}>
                  {items.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onChange(p);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="items-start"
                    >
                      <Check className={cn("mt-1", value?.id === p.id ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          {formatPrescriberName(p)}
                          {p.isFavorite ? <Star className="size-3.5 fill-brand-accent text-brand-accent" aria-label="favori" /> : null}
                          {p.isRecent ? <History className="size-3.5 text-muted-foreground" aria-label="récent" /> : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.specialty, p.practiceName, p.address.city].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {canCreate ? (
                <CommandGroup>
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      setOpen(false);
                      setCreateOpen(true);
                    }}
                  >
                    <Plus aria-hidden /> {query ? `Créer « ${query} »` : "Nouveau prescripteur"}
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {warnings && (warnings.noEmail || warnings.noAddress) ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning-foreground">
          <TriangleAlert className="size-3.5" aria-hidden />
          {warnings.noEmail && warnings.noAddress
            ? "Ni e-mail ni adresse complète : l'envoi sera impossible."
            : warnings.noEmail
              ? "Pas d'e-mail : envoi par courrier uniquement."
              : "Adresse incomplète : envoi par e-mail uniquement."}
        </p>
      ) : null}
      <PrescriberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        centres={centres}
        salutations={salutations}
        compact
        initial={null}
        prefill={{ lastName: query }}
        key={createOpen ? `new-${query}` : "closed"}
        onSaved={(p) => {
          onChange(p);
          setQuery("");
        }}
      />
    </>
  );
}
