import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Download, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { UnlockForm } from "@/components/secure-link/unlock-form";
import { Button } from "@/components/ui/button";
import { collections } from "@/lib/db/collections";
import { getOrganization } from "@/server/repositories/organizations";
import { centreDisplayName } from "@/lib/brand";
import { formatDateTime } from "@/lib/dates";
import { fr } from "@/lib/i18n/fr";
import { formatPersonName } from "@/lib/text";
import { accessCookieName } from "@/server/actions/secure-link";
import { findLink, verifyAccess } from "@/server/services/secure-links";

export const metadata: Metadata = { title: "Document sécurisé", robots: { index: false, follow: false } };

function Shell({ brand, children }: { brand: { name: string; logo: string | null } | null; children: React.ReactNode }) {
  return (
    <main id="contenu" className="flex min-h-dvh items-start justify-center bg-background p-4 sm:items-center sm:p-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {brand ? (
          <div className="flex justify-center">
            <BrandLogo name={brand.name} logo={brand.logo} className="h-12" />
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}

export default async function SecureLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await findLink(token);
  const org = link ? await getOrganization(link.organizationId) : null;
  const brand = org ? { name: org.brand.name, logo: org.brand.logo } : null;
  if (!link || link.revoked || link.expiresAt < new Date()) {
    return (
      <Shell brand={brand}>
        <div className="space-y-3 text-center" role="alert">
          <TriangleAlert className="mx-auto size-10 text-warning-foreground" aria-hidden />
          <h1 className="text-xl font-bold">Lien invalide ou expiré</h1>
          <p className="text-muted-foreground">Pour des raisons de confidentialité, ce lien n&apos;est plus actif. Contactez le centre auditif pour recevoir un nouvel envoi.</p>
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

  if (!unlocked) {
    return (
      <Shell brand={brand}>
        <div className="space-y-2 text-center">
          <ShieldCheck className="mx-auto size-10 text-brand-fg" aria-hidden />
          <h1 className="text-xl font-bold">Document médical sécurisé</h1>
          <p className="text-sm text-muted-foreground">
            {centreName ? `Transmis par ${centreName}. ` : ""}
            {link.secondFactor === "birthdate"
              ? "Pour l'ouvrir, saisissez la date de naissance du patient concerné."
              : "Pour l'ouvrir, saisissez le code reçu dans un second e-mail."}
          </p>
        </div>
        <UnlockForm token={token} factor={link.secondFactor} />
        <p className="text-center text-xs text-muted-foreground">Lien valable jusqu&apos;au {formatDateTime(link.expiresAt)}. Chaque consultation est enregistrée.</p>
      </Shell>
    );
  }

  const s = doc?.snapshot;
  return (
    <Shell brand={brand}>
      <div className="space-y-1 text-center">
        <FileText className="mx-auto size-10 text-brand-fg" aria-hidden />
        <h1 className="text-xl font-bold">{doc ? fr.documentTypes[doc.type] : "Document"}</h1>
        {s ? (
          <p className="text-muted-foreground">
            {s.patient.civility} {formatPersonName(s.patient.firstName, s.patient.lastName)}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {centreName}
          {dispatch?.sentAt ? ` · envoyé le ${formatDateTime(dispatch.sentAt)}` : ""}
        </p>
      </div>
      <div className="grid gap-3">
        <Button asChild className="h-12">
          <a href={`/l/${token}/pdf`} target="_blank" rel="noreferrer">
            <FileText aria-hidden /> Ouvrir le PDF
          </a>
        </Button>
        <Button asChild variant="outline" className="h-12">
          <a href={`/l/${token}/pdf?telecharger=1`}>
            <Download aria-hidden /> Télécharger
          </a>
        </Button>
      </div>
      {centre ? (
        <p className="text-center text-xs text-muted-foreground">
          Une question ? {centre.phone ? `${centre.phone} · ` : ""}
          {centre.email}
        </p>
      ) : null}
    </Shell>
  );
}
