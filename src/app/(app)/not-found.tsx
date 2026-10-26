import Link from "next/link";
import { House, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/layout/status-screen";
import { BackButton, OpenSearchButton } from "@/components/layout/status-actions";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";

/** Page introuvable dans l'application : la navigation reste disponible, avec la recherche. */
export default function AppNotFound() {
  return (
    <StatusScreen
      icon={<SearchX />}
      eyebrow={shellFr.errors.code404}
      title={fr.errors.notFoundTitle}
      description={fr.errors.notFoundDescription}
      actions={
        <>
          <BackButton />
          <OpenSearchButton />
          <Button asChild>
            <Link href="/">
              <House aria-hidden /> {fr.errors.backHome}
            </Link>
          </Button>
        </>
      }
    />
  );
}
