"use client";

import { useCreateDocument } from "@/hooks/use-create-document";
import { shellFr } from "@/lib/i18n/shell";
import { CreateTile } from "./create-tile";

/** Les deux tuiles de création de l'accueil (côte à côte, y compris sur téléphone). */
export function NewDocumentButtons() {
  const { create, pending, pendingType } = useCreateDocument();
  return (
    <section aria-label={shellFr.home.tilesLabel} className="grid grid-cols-2 gap-3 sm:gap-4">
      {(["ADRESSAGE", "COMPTE_RENDU"] as const).map((type, i) => (
        <CreateTile
          key={type}
          type={type}
          index={i}
          busy={pendingType === type}
          disabled={pending}
          onCreate={() => create(type)}
          // Identifiants réservés aux tuiles de l'accueil (tests E2E) : jamais réutilisés ailleurs.
          testId={`new-${type.toLowerCase()}`}
        />
      ))}
    </section>
  );
}
