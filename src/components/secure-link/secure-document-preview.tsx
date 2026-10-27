"use client";

import { useMemo } from "react";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { secureLinkFr as T } from "@/lib/i18n/secure-link";

/** Aperçu du document dans la page du lien sécurisé (pdf.js, fonctionne aussi sur téléphone). */
export function SecureDocumentPreview({ url, label }: { url: string; label: string }) {
  const request = useMemo(() => ({ method: "GET" as const, url }), [url]);
  return (
    <section aria-label={T.previewLabel} className="rounded-xl bg-muted/50 p-3 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <PdfPreview request={request} label={label} toolbar={false} errorText={T.previewError} />
      </div>
    </section>
  );
}
