import "server-only";
import { collections } from "@/lib/db/collections";
import type { DispatchDoc, DocumentDoc } from "@/lib/db/types";
import { ERROR_STATUSES } from "@/lib/schemas/dispatch";
import { formatPersonName } from "@/lib/text";

/** Résumé (lecture seule) des envois d'un document, pour les actions et indicateurs de liste. */
export interface DocumentDispatchSummary {
  /** Nombre total d'envois, toutes versions confondues. */
  total: number;
  /** Envoi le plus récent (toutes versions). */
  lastId: string | null;
  /** Envoi en erreur le plus récent, non masqué, de la version courante. */
  errorId: string | null;
  /** Dernier envoi par canal pour la version courante. */
  channels: { id: string; channel: DispatchDoc["channel"]; status: DispatchDoc["status"] }[];
}

export interface DocumentListItem {
  id: string;
  type: DocumentDoc["type"];
  status: DocumentDoc["status"];
  patientName: string | null;
  prescriberName: string | null;
  authorName: string;
  centreId: string;
  updatedAt: string;
  version: number;
  /* Champs ajoutés pour les actions de liste : optionnels pour rester compatibles avec les jeux de données existants. */
  patientId?: string | null;
  prescriberId?: string | null;
  authorId?: string;
  dispatches?: DocumentDispatchSummary;
}

export interface DispatchListItem {
  id: string;
  documentId: string;
  documentType: DocumentDoc["type"] | null;
  channel: DispatchDoc["channel"];
  status: DispatchDoc["status"];
  recipientName: string;
  patientName: string | null;
  error: DispatchDoc["error"];
  costCents: number | null;
  mock: boolean;
  createdAt: string;
  updatedAt: string;
  /* Champs ajoutés pour les actions de liste : optionnels pour rester compatibles avec les jeux de données existants. */
  documentVersion?: number;
  patientId?: string | null;
  prescriberId?: string | null;
  recipientEmail?: string | null;
  /** Adresse postale du destinataire sur une ligne (courrier). */
  recipientAddress?: string | null;
  currency?: string | null;
  acknowledged?: boolean;
}

async function nameMaps(patientIds: string[], prescriberIds: string[], userIds: string[]) {
  const [patients, prescribers, users] = await Promise.all([
    patientIds.length ? collections().patients().find({ _id: { $in: patientIds } }, { projection: { civility: 1, firstName: 1, lastName: 1 } }).toArray() : [],
    prescriberIds.length
      ? collections().prescribers().find({ _id: { $in: prescriberIds } }, { projection: { civility: 1, firstName: 1, lastName: 1 } }).toArray()
      : [],
    userIds.length ? collections().users().find({ _id: { $in: userIds } }, { projection: { firstName: 1, lastName: 1 } }).toArray() : [],
  ]);
  return {
    patient: new Map(patients.map((p) => [p._id, `${p.civility} ${formatPersonName(p.firstName, p.lastName)}`])),
    prescriber: new Map(prescribers.map((p) => [p._id, `${p.civility} ${formatPersonName(p.firstName, p.lastName)}`])),
    user: new Map(users.map((u) => [u._id, formatPersonName(u.firstName, u.lastName)])),
  };
}

const uniq = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];

/** Résumé des envois par document (une seule requête, lecture seule, filtrée par organisation). */
async function dispatchSummaries(docs: DocumentDoc[]): Promise<Map<string, DocumentDispatchSummary>> {
  const summaries = new Map<string, DocumentDispatchSummary>();
  if (docs.length === 0) return summaries;
  const versions = new Map(docs.map((d) => [d._id, d.version]));
  const rows = await collections()
    .dispatches()
    .find(
      { organizationId: { $in: uniq(docs.map((d) => d.organizationId)) }, documentId: { $in: docs.map((d) => d._id) } },
      { projection: { documentId: 1, documentVersion: 1, channel: 1, status: 1, acknowledged: 1, createdAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .toArray();
  for (const r of rows) {
    const s = summaries.get(r.documentId) ?? { total: 0, lastId: null, errorId: null, channels: [] };
    s.total += 1;
    s.lastId ??= r._id;
    if (r.documentVersion === versions.get(r.documentId)) {
      if (!s.channels.some((c) => c.channel === r.channel)) s.channels.push({ id: r._id, channel: r.channel, status: r.status });
      if (!s.errorId && !r.acknowledged && (ERROR_STATUSES as readonly string[]).includes(r.status)) s.errorId = r._id;
    }
    summaries.set(r.documentId, s);
  }
  return summaries;
}

const NO_DISPATCH: DocumentDispatchSummary = { total: 0, lastId: null, errorId: null, channels: [] };

export async function hydrateDocuments(docs: DocumentDoc[]): Promise<DocumentListItem[]> {
  const [maps, summaries] = await Promise.all([
    nameMaps(uniq(docs.map((d) => d.patientId)), uniq(docs.map((d) => d.prescriberId)), uniq(docs.map((d) => d.authorId))),
    dispatchSummaries(docs),
  ]);
  return docs.map((d) => ({
    id: d._id,
    type: d.type,
    status: d.status,
    patientName: d.patientId ? (maps.patient.get(d.patientId) ?? null) : null,
    prescriberName: d.prescriberId ? (maps.prescriber.get(d.prescriberId) ?? null) : null,
    authorName: maps.user.get(d.authorId) ?? "",
    centreId: d.centreId,
    updatedAt: d.updatedAt.toISOString(),
    version: d.version,
    patientId: d.patientId,
    prescriberId: d.prescriberId,
    authorId: d.authorId,
    dispatches: summaries.get(d._id) ?? NO_DISPATCH,
  }));
}

export async function hydrateDispatches(dispatches: DispatchDoc[]): Promise<DispatchListItem[]> {
  const docIds = uniq(dispatches.map((d) => d.documentId));
  const docs = docIds.length ? await collections().documents().find({ _id: { $in: docIds } }, { projection: { type: 1 } }).toArray() : [];
  const typeById = new Map(docs.map((d) => [d._id, d.type]));
  const maps = await nameMaps(uniq(dispatches.map((d) => d.patientId)), [], []);
  return dispatches.map((d) => ({
    id: d._id,
    documentId: d.documentId,
    documentType: typeById.get(d.documentId) ?? null,
    channel: d.channel,
    status: d.status,
    recipientName: d.recipient.name,
    patientName: d.patientId ? (maps.patient.get(d.patientId) ?? null) : null,
    error: d.error,
    costCents: d.costCents,
    mock: d.provider.startsWith("mock"),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    documentVersion: d.documentVersion,
    patientId: d.patientId,
    prescriberId: d.prescriberId,
    recipientEmail: d.recipient.email,
    recipientAddress: d.recipient.address
      ? [d.recipient.address.line1, d.recipient.address.line2, `${d.recipient.address.postalCode} ${d.recipient.address.city}`.trim()].filter(Boolean).join(", ")
      : null,
    currency: d.currency,
    acknowledged: Boolean(d.acknowledged),
  }));
}
