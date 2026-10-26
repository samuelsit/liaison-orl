import "server-only";
import { assertAdminViewer, type AdminViewer } from "@/lib/auth/permissions";
import { collections } from "@/lib/db/collections";
import { ERROR_STATUSES } from "@/lib/schemas/dispatch";
import { formatPersonName } from "@/lib/text";

export interface StatsRow {
  key: string;
  label: string;
  adressage: number;
  compteRendu: number;
  total: number;
}

export interface Stats {
  periodDays: number;
  totals: { documents: number; sent: number; emails: number; letters: number; errors: number; errorRate: number; postalCostCents: number; aiCalls: number; aiCostMicroUsd: number; medianHoursToSend: number | null };
  byCentre: (StatsRow & { postalCostCents: number; aiCalls: number; aiCostMicroUsd: number; errors: number })[];
  byAuthor: StatsRow[];
  byPrescriber: StatsRow[];
  monthly: { month: string; adressage: number; compteRendu: number }[];
  aiByKind: { kind: string; calls: number; inputTokens: number; outputTokens: number; costMicroUsd: number; failures: number }[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Statistiques d'activité sur une période (documents, envois, coûts, IA). */
export async function computeStats(viewer: AdminViewer, periodDays: number): Promise<Stats> {
  const organizationId = assertAdminViewer(viewer);
  const since = new Date(Date.now() - periodDays * 86_400_000);
  const [docs, dispatches, ai, centres, users, prescribers] = await Promise.all([
    collections()
      .documents()
      .find({ organizationId, createdAt: { $gte: since } }, { projection: { type: 1, status: 1, centreId: 1, authorId: 1, prescriberId: 1, createdAt: 1 } })
      .toArray(),
    collections()
      .dispatches()
      .find({ organizationId, createdAt: { $gte: since } }, { projection: { channel: 1, status: 1, centreId: 1, costCents: 1, documentId: 1, sentAt: 1, createdAt: 1 } })
      .toArray(),
    collections().aiUsage().find({ organizationId, at: { $gte: since } }).toArray(),
    collections().centres().find({ organizationId }).toArray(),
    collections().users().find({ organizationId }, { projection: { firstName: 1, lastName: 1 } }).toArray(),
    collections().prescribers().find({ organizationId }, { projection: { civility: 1, firstName: 1, lastName: 1 } }).toArray(),
  ]);

  const group = (keyOf: (d: (typeof docs)[number]) => string | null, labelOf: (k: string) => string): StatsRow[] => {
    const m = new Map<string, StatsRow>();
    for (const d of docs) {
      const k = keyOf(d);
      if (!k) continue;
      const row = m.get(k) ?? { key: k, label: labelOf(k), adressage: 0, compteRendu: 0, total: 0 };
      if (d.type === "ADRESSAGE") row.adressage++;
      else row.compteRendu++;
      row.total++;
      m.set(k, row);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  const centreName = new Map(centres.map((c) => [c._id, c.name]));
  const userName = new Map(users.map((u) => [u._id, formatPersonName(u.firstName, u.lastName)]));
  const prescriberName = new Map(prescribers.map((p) => [p._id, `${p.civility} ${formatPersonName(p.firstName, p.lastName)}`]));

  const byCentreBase = group((d) => d.centreId, (k) => centreName.get(k) ?? "Centre supprimé");
  const errorStatuses = new Set<string>(ERROR_STATUSES);
  const byCentre = centres
    .map((c) => {
      const base = byCentreBase.find((r) => r.key === c._id) ?? { key: c._id, label: c.name, adressage: 0, compteRendu: 0, total: 0 };
      const cd = dispatches.filter((d) => d.centreId === c._id);
      const ca = ai.filter((a) => a.centreId === c._id);
      return {
        ...base,
        postalCostCents: cd.reduce((s, d) => s + (d.channel === "COURRIER" ? (d.costCents ?? 0) : 0), 0),
        errors: cd.filter((d) => errorStatuses.has(d.status)).length,
        aiCalls: ca.length,
        aiCostMicroUsd: ca.reduce((s, a) => s + a.costMicroUsd, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  const months: Stats["monthly"] = [];
  const monthCount = Math.min(12, Math.max(1, Math.ceil(periodDays / 30)));
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, adressage: 0, compteRendu: 0 });
  }
  for (const d of docs) {
    const key = `${d.createdAt.getFullYear()}-${String(d.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.month === key);
    if (m) {
      if (d.type === "ADRESSAGE") m.adressage++;
      else m.compteRendu++;
    }
  }

  const docCreated = new Map(docs.map((d) => [d._id, d.createdAt]));
  const delays = dispatches.flatMap((d) => {
    const created = docCreated.get(d.documentId);
    return created && d.sentAt ? [(d.sentAt.getTime() - created.getTime()) / 3_600_000] : [];
  });

  const kinds = new Map<string, Stats["aiByKind"][number]>();
  for (const a of ai) {
    const k = kinds.get(a.kind) ?? { kind: a.kind, calls: 0, inputTokens: 0, outputTokens: 0, costMicroUsd: 0, failures: 0 };
    k.calls++;
    k.inputTokens += a.inputTokens;
    k.outputTokens += a.outputTokens;
    k.costMicroUsd += a.costMicroUsd;
    if (!a.success) k.failures++;
    kinds.set(a.kind, k);
  }

  const errors = dispatches.filter((d) => errorStatuses.has(d.status)).length;
  return {
    periodDays,
    totals: {
      documents: docs.length,
      sent: docs.filter((d) => d.status === "ENVOYE").length,
      emails: dispatches.filter((d) => d.channel === "EMAIL").length,
      letters: dispatches.filter((d) => d.channel === "COURRIER").length,
      errors,
      errorRate: dispatches.length ? errors / dispatches.length : 0,
      postalCostCents: dispatches.reduce((s, d) => s + (d.channel === "COURRIER" ? (d.costCents ?? 0) : 0), 0),
      aiCalls: ai.length,
      aiCostMicroUsd: ai.reduce((s, a) => s + a.costMicroUsd, 0),
      medianHoursToSend: median(delays),
    },
    byCentre,
    byAuthor: group((d) => d.authorId, (k) => userName.get(k) ?? "Utilisateur supprimé"),
    byPrescriber: group((d) => d.prescriberId, (k) => prescriberName.get(k) ?? "Prescripteur supprimé").slice(0, 15),
    monthly: months,
    aiByKind: [...kinds.values()],
  };
}

/** Export CSV (séparateur « ; », BOM UTF-8 pour Excel). */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${[headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n")}\r\n`;
}
