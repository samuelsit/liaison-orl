"use client";

import "./globals.css";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/layout/status-screen";
import { shellFr } from "@/lib/i18n/shell";

/** Dernier filet : erreur dans la mise en page racine elle-même (remplace <html>). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <main className="px-4">
          <StatusScreen
            role="alert"
            tone="danger"
            icon={<TriangleAlert />}
            title={shellFr.errors.globalTitle}
            description={shellFr.errors.globalDescription}
            actions={
              <Button onClick={reset}>
                <RotateCcw aria-hidden /> {shellFr.errors.reload}
              </Button>
            }
          >
            {error.digest ? (
              <p className="mt-4 font-mono text-xs text-muted-foreground">{shellFr.errors.reference(error.digest)}</p>
            ) : null}
          </StatusScreen>
        </main>
      </body>
    </html>
  );
}
