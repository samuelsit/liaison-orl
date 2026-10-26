"use client";

import { useEffect } from "react";
import Link from "next/link";
import { House, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/components/layout/status-screen";
import { CopyReferenceButton } from "@/components/layout/status-actions";
import { fr } from "@/lib/i18n/fr";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusScreen
      role="alert"
      tone="danger"
      icon={<TriangleAlert />}
      title={fr.errors.title}
      description={fr.errors.description}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/">
              <House aria-hidden /> {fr.errors.backHome}
            </Link>
          </Button>
          <Button onClick={reset}>
            <RotateCcw aria-hidden /> {fr.common.retry}
          </Button>
        </>
      }
    >
      {error.digest ? (
        <div className="mt-4">
          <CopyReferenceButton reference={error.digest} />
        </div>
      ) : null}
    </StatusScreen>
  );
}
