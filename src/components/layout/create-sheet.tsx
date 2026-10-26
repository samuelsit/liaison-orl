"use client";

import Link from "next/link";
import { ChevronRight, Stethoscope, UserPlus } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CreateTile } from "@/components/home/create-tile";
import { useCreateDocument } from "@/hooks/use-create-document";
import { shellFr } from "@/lib/i18n/shell";

const C = shellFr.create;

/**
 * Feuille « Créer » de la barre d'onglets mobile : les deux documents en grandes tuiles,
 * puis les fiches patient / ORL. Elle reste ouverte (indicateur sur la tuile) jusqu'à
 * l'ouverture de l'éditeur ; la barre d'onglets la referme au changement de page.
 */
export function CreateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { create, pending, pendingType } = useCreateDocument();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-border" />
        <SheetHeader className="px-4 pt-3 pb-3">
          <SheetTitle>{C.title}</SheetTitle>
          <SheetDescription>{C.description}</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 px-4">
          {(["ADRESSAGE", "COMPTE_RENDU"] as const).map((type, i) => (
            <CreateTile
              key={type}
              type={type}
              index={i}
              variant="sheet"
              busy={pendingType === type}
              disabled={pending}
              onCreate={() => create(type)}
              testId={`create-sheet-${type.toLowerCase()}`}
            />
          ))}
        </div>
        <ul aria-label={C.others} className="mt-3 px-2">
          {[
            { href: "/patients?nouveau=1", label: C.newPatient, icon: UserPlus },
            { href: "/prescripteurs?nouveau=1", label: C.newPrescriber, icon: Stethoscope },
          ].map((item) => (
            <li key={item.href}>
              <SheetClose asChild>
                <Link
                  href={item.href}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/25"
                >
                  <span aria-hidden className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
                    <item.icon />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                </Link>
              </SheetClose>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
