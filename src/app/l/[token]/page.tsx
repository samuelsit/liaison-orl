import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Download, ExternalLink, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { UnlockForm } from "@/components/secure-link/unlock-form";
import { SecureDocumentPreview } from "@/components/secure-link/secure-document-preview";
import { Button } from "@/components/ui/button";
import { collections } from "@/lib/db/collections";
import { getOrganization } from "@/server/repositories/organizations";
import { centreDisplayName, legalLine } from "@/lib/brand";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { fr } from "@/lib/i18n/fr";
import { secureLinkFr as T } from "@/lib/i18n/secure-link";
import { formatPersonName } from "@/lib/text";
import { accessCookieName } from "@/server/actions/secure-link";
import { findLink, verifyAccess } from "@/server/services/secure-links";

export const metadata: Metadata = { title: "Document sécurisé", robots: { index: false, follow: false } };

interface ShellBrand {
  name: string;
  logo: string | null;
  legal: string;
}

/**
 * Cadre sobre de la page du médecin : logo (sur plaque blanche, lisible en mode sombre),
 * filet bleu avec accent orange, contenu, pied avec mentions et confidentialité.
 */
function Shell({
  brand,
  contact,
  children,
}: {
  brand: ShellBrand | null;
  contact?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background font-sans">
      <header className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {brand?.logo ? (
            <span className="inline-flex rounded-md bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt={brand.name} className="h-10 w-auto object-contain" />
            </span>
          ) : brand ? (
            <span className="text-lg font-semibold text-brand-fg">{brand.name}</span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden /> {T.confidentialBadge}
          </span>
        </div>
        <div className="relative mt-5 h-px bg-brand-fg/40" aria-hidden>
          <span className="absolute -top-px left-0 h-[3px] w-10 rounded-full bg-brand-accent" />
        </div>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-3xl space-y-1 border-t px-4 py-6 text-sm text-muted-foreground sm:px-6">
        {contact}
        {brand?.legal ? <p>{brand.legal}</p> : null}
        <p>{T.confidentialFooter}</p>
      </footer>
    </div>
  );
}

export default async function SecureLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await findLink(token);
  const org = link ? await getOrganization(link.organizationId) : null;
  const brand = org ? { name: org.brand.name, logo: org.brand.logo, legal: legalLine(org.legal) } : null;
  if (!link || link.revoked || link.expiresAt < new Date()) {
    return (
      <Shell brand={brand}>
        <div className="max-w-xl space-y-3" role="alert">
          <TriangleAlert className="size-8 text-warning-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">{T.expiredTitle}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{T.expiredText}</p>
        </div>
      </Shell>
    );
  }
  const [doc, dispatch] = await Promise.all([
    collections().documents().findOne({ _id: link.documentId }),
    collections().dispatches().findOne({ _id: link.dispatchId }),
  ]);
  const centre = doc ? await collections().centres().findOne({ _id: doc.centreId }) : null;
  const centreName = org && centre ? centreDisplayName(org.brand.name, centre.name) : "";
  const unlocked = verifyAccess(link._id, (await cookies()).get(await accessCookieName(link._id))?.value);
  const contact = centre ? (
    <p>
      {T.contact(centreName)}{" "}
      {centre.phone ? (
        <a
          className="font-medium text-brand-fg underline-offset-4 hover:underline"
          href={`tel:${centre.phone.replace(/[^\d+]/g, "")}`}
        >
          {centre.phone}
        </a>
      ) : null}
      {centre.phone && centre.email ? " · " : null}
      {centre.email ? (
        <a className="font-medium text-brand-fg underline-offset-4 hover:underline" href={`mailto:${centre.email}`}>
          {centre.email}
        </a>
      ) : null}
    </p>
  ) : null;

  if (!unlocked) {
    return (
      <Shell brand={brand} contact={contact}>
        <div className="max-w-md space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{T.lockedTitle}</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              {centreName ? T.sentBy(centreName) : null}
              {link.secondFactor === "birthdate" ? T.askBirthdate : T.askCode}
            </p>
          </div>
          <UnlockForm token={token} factor={link.secondFactor} />
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
            {T.validity(formatLongDate(link.expiresAt))}
          </p>
        </div>
      </Shell>
    );
  }

  const s = doc?.snapshot;
  const title = doc ? fr.documentTypes[doc.type] : T.documentFallback;
  return (
    <Shell brand={brand} contact={contact}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {s ? (
              <p className="text-base">
                {s.patient.civility} {formatPersonName(s.patient.firstName, s.patient.lastName)}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {centreName}
              {dispatch?.sentAt ? ` · ${T.sentOn(formatDateTime(dispatch.sentAt))}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-11">
              <a href={`/l/${token}/pdf`} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> {T.open}
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <a href={`/l/${token}/pdf?telecharger=1`}>
                <Download aria-hidden /> {T.download}
              </a>
            </Button>
          </div>
        </div>
        <SecureDocumentPreview url={`/l/${token}/pdf`} label={title} />
        <p className="text-sm text-muted-foreground">{T.logged}</p>
      </div>
    </Shell>
  );
}
