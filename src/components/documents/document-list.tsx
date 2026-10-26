import type { ReactNode } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { can } from "@/lib/auth/permissions";
import { getUserContext } from "@/lib/auth/session";
import type { DocumentListItem } from "@/server/services/hydrate";
import { DocumentRows, type DocumentViewer } from "./document-rows";

/** Utilisateur courant, pour décider des actions de ligne (lecture de la session, mise en cache par requête). */
export async function currentDocumentViewer(): Promise<DocumentViewer> {
  const ctx = await getUserContext();
  return { userId: ctx.user.id, role: ctx.user.role, canSend: can(ctx.user, "document.send", ctx.organization.settings) };
}

/**
 * Liste de documents sans habillage (composant serveur) : à placer dans une SectionCard `flush`
 * ou un ListRowContainer. Chaque ligne reçoit ses actions (préparer l'envoi, suivi, PDF,
 * suppression d'un brouillon…) selon les droits de l'utilisateur courant, sauf si `viewer` est fourni.
 */
export async function DocumentList({
  items,
  empty = "",
  emptyState,
  showAuthor,
  hideStatus,
  viewer,
}: {
  items: DocumentListItem[];
  empty?: string;
  /** État vide complet (icône, description, action) ; remplace `empty`. */
  emptyState?: ReactNode;
  showAuthor?: boolean;
  /** Masque le statut quand la liste est déjà filtrée par statut (« À finir »). */
  hideStatus?: boolean;
  viewer?: DocumentViewer;
}) {
  if (items.length === 0) return emptyState ?? (empty ? <EmptyState title={empty} /> : null);
  return <DocumentRows items={items} viewer={viewer ?? (await currentDocumentViewer())} showAuthor={showAuthor} hideStatus={hideStatus} />;
}
