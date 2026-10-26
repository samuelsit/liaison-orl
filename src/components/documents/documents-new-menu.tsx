"use client";

import { ChevronDown, ClipboardList, FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Shortcut } from "@/components/ui/shortcut";
import { useCreateDocument } from "@/hooks/use-create-document";
import { dispFr } from "@/lib/i18n/dispatch";

/**
 * « Nouveau document » de la page Documents : un bouton (déclencheur de menu, pas un lien)
 * qui crée un courrier d'adressage ou un compte rendu ; les raccourcis A / C restent globaux.
 */
export function DocumentsNewMenu({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: "default" | "outline";
  size?: "default" | "sm";
  className?: string;
}) {
  const { create, pending } = useCreateDocument();
  const D = dispFr.documents;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={pending} className={className}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {D.newDocument}
          <ChevronDown className="-mr-1 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuItem onSelect={() => create("ADRESSAGE")}>
          <FileText aria-hidden />
          {D.newAdressage}
          <Shortcut keys={["a"]} className="ml-auto" />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => create("COMPTE_RENDU")}>
          <ClipboardList aria-hidden />
          {D.newCompteRendu}
          <Shortcut keys={["c"]} className="ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
