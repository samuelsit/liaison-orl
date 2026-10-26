import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminContext } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { formatDateTime } from "@/lib/dates";
import { AUDIT_LABELS } from "@/lib/i18n/audit";
import { formatPersonName } from "@/lib/text";
import { queryAudit } from "@/server/services/audit-query";

export const metadata: Metadata = { title: "Journal d'audit" };

const GROUPS: [string, string][] = [
  ["", "Toutes les actions"],
  ["document.", "Documents"],
  ["dispatch.", "Envois"],
  ["secure_link.", "Liens sécurisés"],
  ["patient.", "Patients"],
  ["prescriber.", "Annuaire"],
  ["attachment.", "Bilans"],
  ["ai.", "IA"],
  ["user.", "Utilisateurs"],
  ["settings.update", "Paramètres"],
  ["purge.run", "Purges"],
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getAdminContext();
  const sp = await searchParams;
  const query = { userId: sp.utilisateur || undefined, action: sp.action || undefined, from: sp.du || undefined, to: sp.au || undefined, q: sp.ref || undefined, page: Number(sp.page) || 1 };
  const [res, users] = await Promise.all([
    queryAudit(ctx.user, query),
    collections().users().find({ organizationId: ctx.user.organizationId }, { projection: { firstName: 1, lastName: 1 } }).toArray(),
  ]);
  const params = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => Boolean(e[1]) && e[0] !== "page"));
  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <label className="space-y-1 text-sm lg:col-span-2">
          <span className="text-muted-foreground">Utilisateur</span>
          <select name="utilisateur" defaultValue={sp.utilisateur ?? ""} className="h-10 w-full rounded-md border bg-background px-2">
            <option value="">Tous</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {formatPersonName(u.firstName, u.lastName)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm lg:col-span-2">
          <span className="text-muted-foreground">Action</span>
          <select name="action" defaultValue={sp.action ?? ""} className="h-10 w-full rounded-md border bg-background px-2">
            {GROUPS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Du</span>
          <Input type="date" name="du" defaultValue={sp.du} className="h-10" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Au</span>
          <Input type="date" name="au" defaultValue={sp.au} className="h-10" />
        </label>
        <label className="space-y-1 text-sm lg:col-span-3">
          <span className="text-muted-foreground">Identifiant d&apos;élément (document, patient…)</span>
          <Input name="ref" defaultValue={sp.ref} className="h-10" />
        </label>
        <div className="flex flex-wrap items-end gap-2 lg:col-span-3">
          <Button type="submit" className="h-10">
            Filtrer
          </Button>
          <Button asChild variant="ghost" className="h-10">
            <Link href="/admin/audit">Réinitialiser</Link>
          </Button>
          <Button asChild variant="outline" className="ml-auto h-10">
            <a href={`/api/admin/audit?${params.toString()}`}>
              <Download aria-hidden /> Exporter (CSV)
            </a>
          </Button>
        </div>
      </form>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {res.total.toLocaleString("fr-FR")} entrée(s). Le journal est en ajout seul : aucune entrée ne peut être modifiée.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
              <th scope="col" className="px-3 py-2 font-medium">Utilisateur</th>
              <th scope="col" className="px-3 py-2 font-medium">Action</th>
              <th scope="col" className="px-3 py-2 font-medium">Élément</th>
              <th scope="col" className="px-3 py-2 font-medium">Adresse IP</th>
            </tr>
          </thead>
          <tbody>
            {res.items.map((r) => (
              <tr key={r._id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDateTime(r.at)}</td>
                <td className="px-3 py-2">{r.userName ?? <span className="text-muted-foreground">Destinataire / système</span>}</td>
                <td className="px-3 py-2">{AUDIT_LABELS[r.action] ?? r.action}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.entityType}
                  {r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {res.pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3 text-sm">
          {res.page > 1 ? <Link className="underline" href={`/admin/audit?${params.toString()}&page=${res.page - 1}`}>Précédent</Link> : null}
          <span>
            Page {res.page} / {res.pages}
          </span>
          {res.page < res.pages ? <Link className="underline" href={`/admin/audit?${params.toString()}&page=${res.page + 1}`}>Suivant</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
