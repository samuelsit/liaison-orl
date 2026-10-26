"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ClipboardList, Download, FilePlus2, FileText, Loader2, Mail, Mailbox, Route, Send, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DISPATCH_STATUS_TONE, DocumentStatusBadge } from "@/components/documents/status-badge";
import { ListRow, ListRowControl, ListRowGroup, ListRowIcon, ListRows } from "@/components/layout/list-row";
import type { RowAction } from "@/components/layout/list-row-actions";
import { groupByDate } from "@/components/dispatches/list-utils";
import { RowActionsCluster } from "@/components/dispatches/row-actions-cluster";
import { useCreateDocument } from "@/hooks/use-create-document";
import { fr } from "@/lib/i18n/fr";
import { dispFr } from "@/lib/i18n/dispatch";
import type { Role } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import { deleteDocumentAction } from "@/server/actions/documents";
import type { DocumentDispatchSummary, DocumentListItem } from "@/server/services/hydrate";

/** Utilisateur qui consulte la liste : décide des actions proposées (toujours revérifiées côté serveur). */
export interface DocumentViewer {
  userId: string;
  role: Role;
  canSend: boolean;
}

/** Sélection pour l'envoi groupé (documents validés uniquement). */
export interface DocumentSelection {
  selected: readonly string[];
  toggle: (id: string) => void;
}

const MotionListRow = motion.create(ListRow);

/** Repli complet de la ligne supprimée (hauteur, marges internes), 160 ms. */
const ROW_EXIT = { opacity: 0, height: 0, minHeight: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } } as const;

/**
 * Même règle que la page du document et que deleteDocument : un brouillon jamais envoyé,
 * par son auteur ou par un audioprothésiste / administrateur.
 */
export function canDeleteDraft(item: DocumentListItem, viewer: DocumentViewer): boolean {
  if (item.status !== "BROUILLON") return false;
  if ((item.dispatches?.total ?? 0) > 0) return false;
  return viewer.role !== "assistant" || item.authorId === viewer.userId;
}

const TONE_TEXT = {
  success: "text-success-foreground",
  danger: "text-destructive",
  warning: "text-warning-foreground",
  info: "text-info-foreground",
} as const;

/** Mini-indicateurs par canal d'un document envoyé (e-mail consulté, courrier posté…). */
function DispatchIndicators({ summary }: { summary: DocumentDispatchSummary }) {
  if (summary.channels.length === 0) return null;
  const parts = summary.channels.map((c) => dispFr.indicators.part(fr.channels[c.channel], fr.dispatchStatus[c.status]));
  const label = dispFr.indicators.label(parts);
  return (
    <span role="img" aria-label={label} title={label} className="flex items-center gap-1.5">
      {summary.channels.map((c) => {
        const Icon = c.channel === "EMAIL" ? Mail : Mailbox;
        const tone = DISPATCH_STATUS_TONE[c.status];
        return <Icon key={c.channel} aria-hidden className={cn("size-4", tone in TONE_TEXT ? TONE_TEXT[tone as keyof typeof TONE_TEXT] : "text-muted-foreground")} />;
      })}
    </span>
  );
}

/** Joint des fragments par « · » (les fragments peuvent être stylés). */
function joinMeta(parts: ReactNode[]): ReactNode {
  const list = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return list.map((p, i) => (
    <Fragment key={i}>
      {i > 0 ? " · " : null}
      {p}
    </Fragment>
  ));
}

function rowActions(
  item: DocumentListItem,
  viewer: DocumentViewer,
  handlers: { askDelete: (item: DocumentListItem) => void; createFor: (type: DocumentListItem["type"], item: DocumentListItem) => void },
): { primary: RowAction[]; more: RowAction[] } {
  const T = dispFr.rowActions;
  const d = item.dispatches;
  const primary: RowAction[] = [];
  const more: RowAction[] = [];
  if (item.status === "VALIDE" && viewer.canSend) primary.push({ label: T.prepareSend, icon: <Send />, href: `/documents/${item.id}/envoi` });
  if (item.status === "ERREUR" && (d?.errorId ?? d?.lastId)) primary.push({ label: T.fix, icon: <TriangleAlert />, href: `/envois/${d?.errorId ?? d?.lastId}` });
  if (item.status === "ENVOYE" && d?.lastId) primary.push({ label: T.track, icon: <Route />, href: `/envois/${d.lastId}` });
  if (item.status !== "BROUILLON") primary.push({ label: T.downloadPdf, icon: <Download />, href: `/api/documents/${item.id}/pdf?telecharger=1`, download: true });
  if (item.patientId && item.status !== "BROUILLON") {
    const crFirst = item.type === "ADRESSAGE";
    const cr: RowAction = { label: T.newCompteRenduFor, icon: <FilePlus2 />, onSelect: () => handlers.createFor("COMPTE_RENDU", item) };
    const ad: RowAction = { label: T.newAdressageFor, icon: <FilePlus2 />, onSelect: () => handlers.createFor("ADRESSAGE", item) };
    more.push(...(crFirst ? [cr, ad] : [ad, cr]));
  }
  if (canDeleteDraft(item, viewer)) more.push({ label: T.deleteDraft, icon: <Trash2 />, onSelect: () => handlers.askDelete(item), destructive: true });
  return { primary, more };
}

/**
 * Lignes de documents (composant client) : lien principal étiré en premier dans le DOM,
 * actions contextuelles (envoyer, suivi, corriger, PDF, document suivant, suppression d'un
 * brouillon avec confirmation), case à cocher sur les documents validés en mode sélection.
 */
export function DocumentRows({
  items,
  viewer,
  showAuthor = true,
  hideStatus = false,
  grouped = false,
  animated = false,
  selection,
}: {
  items: DocumentListItem[];
  viewer: DocumentViewer;
  showAuthor?: boolean;
  /** Masque le statut (liste déjà filtrée par statut, ex. « À finir » sur l'accueil). */
  hideStatus?: boolean;
  /** Sous-titres par période (« Aujourd'hui », « Cette semaine », « Plus ancien »). */
  grouped?: boolean;
  animated?: boolean;
  selection?: DocumentSelection;
}) {
  const router = useRouter();
  const { create } = useCreateDocument();
  const [removed, setRemoved] = useState<readonly string[]>([]);
  const [toDelete, setToDelete] = useState<DocumentListItem | null>(null);
  const [pending, start] = useTransition();
  const visible = items.filter((i) => !removed.includes(i.id));

  const handlers = {
    askDelete: (item: DocumentListItem) => setToDelete(item),
    createFor: (type: DocumentListItem["type"], item: DocumentListItem) => create(type, { patientId: item.patientId ?? null, prescriberId: item.prescriberId ?? null }),
  };

  function confirmDelete() {
    const item = toDelete;
    if (!item) return;
    start(async () => {
      const res = await deleteDocumentAction(item.id);
      if (!res.ok) return void toast.error(res.error);
      setRemoved((r) => [...r, item.id]);
      setToDelete(null);
      toast.success(dispFr.rowActions.deleted);
      router.refresh();
    });
  }

  const row = (item: DocumentListItem) => {
    const Icon = item.type === "ADRESSAGE" ? FileText : ClipboardList;
    const type = fr.documentTypesShort[item.type];
    const draft = item.status === "BROUILLON";
    const missingPrescriber = draft && !item.prescriberName ? <span className="text-warning-foreground">{dispFr.documents.noPrescriber}</span> : null;
    const selectable = Boolean(selection) && viewer.canSend && item.status === "VALIDE";
    const checked = selectable && selection!.selected.includes(item.id);
    const name = item.patientName ?? dispFr.documents.noPatient;
    const { primary, more } = rowActions(item, viewer, handlers);
    return (
      <MotionListRow
        key={item.id}
        exit={ROW_EXIT}
        style={{ overflow: removed.length ? "hidden" : undefined }}
        href={`/documents/${item.id}`}
        selected={checked}
        leading={
          selectable ? (
            <ListRowControl className="pointer-coarse:-mx-1.5">
              <Checkbox checked={checked} onCheckedChange={() => selection!.toggle(item.id)} aria-label={dispFr.documents.selectRow(name)} />
            </ListRowControl>
          ) : (
            <ListRowIcon>
              <Icon />
            </ListRowIcon>
          )
        }
        title={item.patientName ?? <span className="font-normal text-muted-foreground italic">{dispFr.documents.noPatient}</span>}
        subtitle={joinMeta([type, item.prescriberName ?? missingPrescriber, showAuthor ? item.authorName : null])}
        // Mobile : une seule information secondaire, le prescripteur (ou ce qui manque, sinon le type).
        subtitleMobile={item.prescriberName ?? missingPrescriber ?? type}
        trailing={item.dispatches && (item.status === "ENVOYE" || item.status === "ERREUR") ? <DispatchIndicators summary={item.dispatches} /> : undefined}
        badge={hideStatus ? undefined : <DocumentStatusBadge status={item.status} />}
        date={item.updatedAt}
        pinnedActions={<RowActionsCluster primary={primary} more={more} label={`${fr.common.moreActions} : ${name}`} />}
      />
    );
  };

  return (
    <>
      {grouped ? (
        groupByDate(visible, (i) => i.updatedAt).map((g) => (
          <ListRowGroup key={g.key} label={fr.common.dateGroups[g.key]} animated={animated}>
            <AnimatePresence initial={false}>{g.items.map(row)}</AnimatePresence>
          </ListRowGroup>
        ))
      ) : (
        <ListRows animated={animated}>
          <AnimatePresence initial={false}>{visible.map(row)}</AnimatePresence>
        </ListRows>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && !pending && setToDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{dispFr.rowActions.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dispFr.rowActions.deleteDescription(toDelete?.patientName ?? null)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{fr.common.cancel}</AlertDialogCancel>
            <Button variant="destructive-solid" onClick={confirmDelete} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              {dispFr.rowActions.deleteConfirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
