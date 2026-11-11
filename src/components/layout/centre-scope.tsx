"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { Building2, History } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";
import type { DocumentType } from "@/lib/schemas/document";

/*
 * Vue des centres partagée par l'application : en vue « Tous les centres » (administrateurs),
 * un nouveau document demande à quel centre il se rattache (fenêtre unique, quel que soit
 * le déclencheur : tuiles, raccourcis, palette, menus).
 */

export interface CentreScope {
  allCentres: boolean;
  centres: { id: string; name: string }[];
  /** Dernier centre réel choisi : proposé en premier. */
  lastCentreId: string;
}

const CentreScopeContext = createContext<CentreScope>({ allCentres: false, centres: [], lastCentreId: "" });

export function useCentreScope(): CentreScope {
  return useContext(CentreScopeContext);
}

export interface CentreRequest {
  type: DocumentType;
  onPick: (centreId: string) => void;
}

/** Magasin minimal (testable) de la demande de centre en cours. */
export function createCentreRequestStore() {
  let state: CentreRequest | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(request: CentreRequest) {
      state = request;
      emit();
    },
    close() {
      if (!state) return;
      state = null;
      emit();
    },
  };
}

export const centreRequests = createCentreRequestStore();
const getServerSnapshot = () => null;

export function CentreScopeProvider({ value, children }: { value: CentreScope; children: ReactNode }) {
  return (
    <CentreScopeContext.Provider value={value}>
      {children}
      {value.allCentres ? <CentrePickerDialog scope={value} /> : null}
    </CentreScopeContext.Provider>
  );
}

const C = shellFr.create;

/** Ordre de la liste : le dernier centre utilisé en tête, puis les autres par ordre alphabétique (déjà trié). */
export function orderCentres(centres: CentreScope["centres"], lastCentreId: string) {
  const last = centres.find((c) => c.id === lastCentreId) ?? null;
  return { last, others: centres.filter((c) => c.id !== last?.id) };
}

function CentrePickerDialog({ scope }: { scope: CentreScope }) {
  const request = useSyncExternalStore(centreRequests.subscribe, centreRequests.get, getServerSnapshot);
  const { last, others } = orderCentres(scope.centres, scope.lastCentreId);

  function pick(id: string) {
    const current = centreRequests.get();
    centreRequests.close();
    current?.onPick(id);
  }

  const item = (c: { id: string; name: string }, icon: ReactNode) => (
    <CommandItem key={c.id} value={`${c.name} ${c.id}`} onSelect={() => pick(c.id)} className="min-h-11">
      {icon}
      <span className="flex-1 truncate">{c.name}</span>
    </CommandItem>
  );

  return (
    <Dialog open={request !== null} onOpenChange={(o) => (o ? undefined : centreRequests.close())}>
      <DialogContent size="sm" data-testid="centre-picker">
        <DialogHeader>
          <DialogTitle>{C.pickCentreTitle}</DialogTitle>
          <DialogDescription>
            {request ? C.pickCentreDescription(fr.documentTypes[request.type]) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="px-0 pb-2 sm:px-0">
          <Command className="bg-transparent">
            {scope.centres.length > 6 ? <CommandInput placeholder={shellFr.sidebar.searchCentre} autoFocus /> : null}
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>{shellFr.sidebar.noCentre}</CommandEmpty>
              {last ? (
                <CommandGroup heading={C.pickCentreLast}>
                  {item(last, <History aria-hidden className="text-muted-foreground" />)}
                </CommandGroup>
              ) : null}
              {others.length ? (
                <CommandGroup heading={last ? C.pickCentreOthers : shellFr.sidebar.centresList}>
                  {others.map((c) => item(c, <Building2 aria-hidden className="text-muted-foreground" />))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
