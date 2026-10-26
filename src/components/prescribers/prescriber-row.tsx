"use client";

import { Archive, ArchiveRestore, ClipboardPlus, Copy, FilePlus2, Mail, Mailbox, Pencil, Phone } from "lucide-react";
import { ListRow, ListRowAvatar } from "@/components/layout/list-row";
import type { RowAction } from "@/components/layout/list-row-actions";
import { Badge } from "@/components/ui/badge";
import { Highlight } from "@/components/directory/highlight";
import { DirectoryRowActions } from "@/components/directory/row-actions";
import { personInitials } from "@/components/directory/utils";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";
import type { DocumentType } from "@/lib/schemas/document";
import { cn } from "@/lib/utils";
import type { PrescriberView } from "@/server/services/prescribers";
import { FavoriteToggle } from "./favorite-toggle";
import { channelReadiness, formatPrescriberName } from "./format";

const T = dirFr.prescribers;

/** Icônes du canal préféré (une par canal) : grises si utilisables, en alerte (point) sinon. */
function ChannelCluster({ p }: { p: PrescriberView }) {
  const r = channelReadiness(p);
  const items = [
    p.preferredChannel !== "courrier" ? { key: "email", Icon: Mail, ok: r.email, text: r.email ? T.channelEmailReady(p.email) : T.channelEmailMissing } : null,
    p.preferredChannel !== "email" ? { key: "post", Icon: Mailbox, ok: r.post, text: r.post ? T.channelPostReady : T.channelPostMissing } : null,
  ].filter((i) => i !== null);
  const summary = [T.channelLabel(fr.preferredChannel[p.preferredChannel]), ...items.filter((i) => !i.ok).map((i) => i.text)].join(". ");
  return (
    <span className="flex w-12 items-center justify-end gap-1.5" title={[T.channelLabel(fr.preferredChannel[p.preferredChannel]), ...items.map((i) => i.text)].join("\n")}>
      {items.map(({ key, Icon, ok }) => (
        <span key={key} aria-hidden className={cn("relative inline-flex", ok ? "text-muted-foreground" : "text-warning-foreground")}>
          <Icon className="size-4" />
          {ok ? null : <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-current ring-2 ring-card" />}
        </span>
      ))}
      <span className="sr-only">{summary}</span>
    </span>
  );
}

/**
 * Ligne de l'annuaire : avatar, nom (termes recherchés surlignés), cabinet et ville,
 * canal préféré, étoile favori toujours visible, actions rapides au survol
 * (Nouvel adressage, Nouveau compte rendu) et menu ⋯ (copier, appeler, modifier, archiver).
 */
export function PrescriberRow({
  p,
  query,
  canEdit,
  canArchive,
  onCreate,
  onEdit,
  onArchive,
  onCopyEmail,
}: {
  p: PrescriberView;
  query?: string;
  canEdit: boolean;
  canArchive: boolean;
  onCreate: (type: DocumentType, p: PrescriberView) => void;
  onEdit: (p: PrescriberView) => void;
  onArchive: (p: PrescriberView, archived: boolean) => void;
  onCopyEmail: (p: PrescriberView) => void;
}) {
  const name = formatPrescriberName(p);
  const city = [p.address.postalCode, p.address.city].filter(Boolean).join(" ");
  const specialty = p.specialty && p.specialty !== "ORL" ? p.specialty : null;
  const hl = (text: string) => <Highlight text={text} query={query} />;
  const join = (parts: (string | null)[]) => {
    const kept = parts.filter((x): x is string => Boolean(x));
    return kept.map((part, i) => (
      <span key={i}>
        {i > 0 ? " · " : null}
        {hl(part)}
      </span>
    ));
  };

  const quick: RowAction[] = p.archived
    ? []
    : [
        { label: fr.home.newAdressage, icon: <FilePlus2 />, onSelect: () => onCreate("ADRESSAGE", p), shortcut: ["a"] },
        { label: fr.home.newCompteRendu, icon: <ClipboardPlus />, onSelect: () => onCreate("COMPTE_RENDU", p), shortcut: ["c"] },
      ];
  const menu: RowAction[] = [
    ...(p.email ? [{ label: T.copyEmail, icon: <Copy />, onSelect: () => onCopyEmail(p) }] : []),
    ...(p.phone ? [{ label: T.call, icon: <Phone />, href: `tel:${p.phone.replace(/\s/g, "")}` }] : []),
    ...(canEdit ? [{ label: fr.common.edit, icon: <Pencil />, onSelect: () => onEdit(p) }] : []),
    ...(canArchive
      ? [
          {
            label: p.archived ? T.restore : T.archive,
            icon: p.archived ? <ArchiveRestore /> : <Archive />,
            onSelect: () => onArchive(p, !p.archived),
            destructive: !p.archived,
          },
        ]
      : []),
  ];

  return (
    <ListRow
      href={`/prescripteurs/${p.id}`}
      leading={<ListRowAvatar initials={personInitials(p.firstName, p.lastName)} />}
      title={hl(name)}
      subtitle={join([specialty, p.practiceName, city])}
      // Mobile : la ville d'abord (elle distingue deux homonymes), puis le cabinet.
      subtitleMobile={join([p.address.city || null, p.practiceName || specialty])}
      trailing={<ChannelCluster p={p} />}
      badge={p.archived ? <Badge tone="neutral">{T.archivedBadge}</Badge> : undefined}
      pinnedActions={
        <>
          <FavoriteToggle id={p.id} favorite={p.isFavorite} name={name} />
          <DirectoryRowActions quick={quick} menu={menu} label={T.rowActions(name)} />
        </>
      }
    />
  );
}
