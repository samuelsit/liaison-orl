"use client";

import { useState, type ReactNode } from "react";
import { FileText, Mail, Mailbox, RotateCcw, Stethoscope, TriangleAlert } from "lucide-react";
import { DispatchStatusBadge } from "@/components/documents/status-badge";
import { ListRow, ListRowGroup, ListRowIcon, ListRows } from "@/components/layout/list-row";
import type { RowAction } from "@/components/layout/list-row-actions";
import { fr } from "@/lib/i18n/fr";
import { dispFr } from "@/lib/i18n/dispatch";
import type { DispatchListItem } from "@/server/services/hydrate";
import { ResendDialog, type ResendTarget } from "./resend-dialog";
import { groupByDate } from "./list-utils";
import { RowActionsCluster } from "./row-actions-cluster";

function DispatchRow({ item, canSend, onResend }: { item: DispatchListItem; canSend: boolean; onResend: (t: ResendTarget) => void }) {
  const Icon = item.error ? TriangleAlert : item.channel === "EMAIL" ? Mail : Mailbox;
  const recipient = `${fr.channels[item.channel]} → ${item.recipientName}`;
  const type = item.documentType ? fr.documentTypesShort[item.documentType] : null;

  const primary: RowAction[] = [];
  const more: RowAction[] = [];
  if (item.error && canSend) {
    primary.push({
      label: dispFr.rowActions.resend,
      icon: <RotateCcw />,
      onSelect: () =>
        onResend({
          id: item.id,
          channel: item.channel,
          recipientName: item.recipientName,
          recipientEmail: item.recipientEmail,
          recipientAddress: item.recipientAddress,
          costCents: item.costCents,
          currency: item.currency,
        }),
    });
    if (item.prescriberId) primary.push({ label: dispFr.rowActions.fixPrescriber, icon: <Stethoscope />, href: `/prescripteurs/${item.prescriberId}` });
  }
  more.push({ label: dispFr.rowActions.viewDocument, icon: <FileText />, href: `/documents/${item.documentId}` });
  if (!item.error && item.prescriberId) more.push({ label: dispFr.rowActions.prescriberCard, icon: <Stethoscope />, href: `/prescripteurs/${item.prescriberId}` });

  // Erreur : le message passe avant le reste (sur mobile, il remplace le destinataire).
  const errorLine: ReactNode = item.error ? <span className="text-destructive">{item.error.message}</span> : null;
  return (
    <ListRow
      href={`/envois/${item.id}`}
      leading={
        <ListRowIcon tone={item.error ? "danger" : "neutral"}>
          <Icon />
        </ListRowIcon>
      }
      title={item.patientName ?? "—"}
      subtitle={
        <>
          {[recipient, type].filter(Boolean).join(" · ")}
          {errorLine ? <> · {errorLine}</> : null}
        </>
      }
      subtitleMobile={errorLine ?? `→ ${item.recipientName}`}
      badge={<DispatchStatusBadge status={item.status} />}
      date={item.updatedAt}
      pinnedActions={<RowActionsCluster primary={primary} more={more} label={`${fr.common.moreActions} : ${item.patientName ?? item.recipientName}`} />}
    />
  );
}

/**
 * Lignes d'envois (composant client) : patient en titre, « canal → destinataire · type »
 * en sous-titre ; les envois en erreur proposent « Renvoyer » (avec confirmation) et la fiche
 * du prescripteur. `grouped` découpe la liste par période avec sous-titres collants.
 */
export function DispatchRows({
  items,
  canSend,
  grouped = false,
  animated = false,
}: {
  items: DispatchListItem[];
  canSend: boolean;
  grouped?: boolean;
  animated?: boolean;
}) {
  const [target, setTarget] = useState<ResendTarget | null>(null);
  const [open, setOpen] = useState(false);
  const onResend = (t: ResendTarget) => {
    setTarget(t);
    setOpen(true);
  };
  const row = (d: DispatchListItem) => <DispatchRow key={d.id} item={d} canSend={canSend} onResend={onResend} />;

  return (
    <>
      {grouped ? (
        groupByDate(items, (d) => d.updatedAt).map((g) => (
          <ListRowGroup key={g.key} label={fr.common.dateGroups[g.key]} animated={animated}>
            {g.items.map(row)}
          </ListRowGroup>
        ))
      ) : (
        <ListRows animated={animated}>{items.map(row)}</ListRows>
      )}
      <ResendDialog target={target} open={open} onOpenChange={setOpen} />
    </>
  );
}
