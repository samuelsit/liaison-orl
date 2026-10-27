import type { Metadata } from "next";
import { getAdminContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { formatDateTime } from "@/lib/dates";
import { serviceModes } from "@/lib/env";

export const metadata: Metadata = { title: "Boîte d'envoi (démo)" };

const KIND: Record<string, string> = {
  document: "Document",
  "access-code": "Code d'accès",
  invitation: "Invitation",
  "magic-link": "Lien de connexion",
  "reset-password": "Mot de passe",
  "dispatch-error": "Échec d'envoi",
  other: "Autre",
};

export default async function DemoOutboxPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await searchParams;
  const mails = await collections()
    .outbox()
    .find({ $or: [{ organizationId: ctx.user.organizationId }, { organizationId: null }] })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  const selected = mails.find((m) => m._id === id) ?? mails[0];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {serviceModes().email === "mock"
          ? "Aucun e-mail réel n'est envoyé : voici ce que les destinataires auraient reçu (liens sécurisés, invitations, liens de connexion)."
          : "Resend est configuré : les e-mails partent réellement ; cette boîte ne contient que les envois simulés antérieurs."}
      </p>
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <ul className="max-h-[70dvh] divide-y overflow-y-auto rounded-xl border bg-card">
          {mails.map((m) => (
            <li key={m._id}>
              <a href={`/admin/boite-demo?id=${m._id}`} aria-current={selected?._id === m._id ? "true" : undefined} className="block px-4 py-3 text-sm hover:bg-accent aria-[current=true]:bg-accent">
                <span className="block truncate font-medium">{m.subject}</span>
                <span className="block truncate text-muted-foreground">
                  {KIND[m.kind] ?? m.kind} · {m.to.join(", ")}
                </span>
                <span className="block text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
              </a>
            </li>
          ))}
          {mails.length === 0 ? <li className="p-4 text-sm text-muted-foreground">Aucun e-mail simulé.</li> : null}
        </ul>
        {selected ? (
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <p className="text-sm">
              <strong>{selected.subject}</strong>
              <br />
              De : {selected.from} · À : {selected.to.join(", ")}
              {selected.cc.length ? ` · Cc : ${selected.cc.join(", ")}` : ""}
              {selected.attachments.length ? ` · Pièce jointe : ${selected.attachments.map((a) => a.filename).join(", ")}` : ""}
            </p>
            <iframe title="Contenu de l'e-mail" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={selected.html} className="h-[70dvh] w-full rounded-lg border bg-white" />
          </section>
        ) : null}
      </div>
    </div>
  );
}
