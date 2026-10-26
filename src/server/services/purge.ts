import "server-only";
import { collections } from "@/lib/db/collections";
import { storage } from "./storage";

export interface PurgeReport {
  documents: number;
  patients: number;
  files: number;
  auditLogs: number;
  outbox: number;
  secureLinks: number;
  aiUsage: number;
}

const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d;
};

/**
 * Purge automatique selon les durées de conservation de chaque organisation :
 * documents (et leurs bilans, envois, PDF) non modifiés depuis la durée choisie,
 * patients sans document, journaux, e-mails simulés et liens expirés.
 * `dryRun` compte sans supprimer (aperçu avant purge manuelle).
 */
export async function runPurge(opts: { organizationId?: string; dryRun?: boolean } = {}): Promise<PurgeReport> {
  const report: PurgeReport = { documents: 0, patients: 0, files: 0, auditLogs: 0, outbox: 0, secureLinks: 0, aiUsage: 0 };
  const orgs = await collections()
    .organizations()
    .find(opts.organizationId ? { _id: opts.organizationId } : {})
    .toArray();
  for (const org of orgs) {
    const r = org.settings.retention;
    const docCutoff = monthsAgo(r.documentsMonths);
    const old = await collections()
      .documents()
      .find({ organizationId: org._id, updatedAt: { $lt: docCutoff } }, { projection: { _id: 1, pdfKey: 1, patientId: 1 } })
      .toArray();
    const docIds = old.map((d) => d._id);
    const [attachments, dispatches] = await Promise.all([
      collections().attachments().find({ documentId: { $in: docIds } }, { projection: { fileKey: 1 } }).toArray(),
      collections().dispatches().find({ documentId: { $in: docIds } }, { projection: { pdfKey: 1, proofKey: 1 } }).toArray(),
    ]);
    const versionKeys = old.flatMap((d) => (d.pdfKey ? [d.pdfKey] : []));
    const keys = [...versionKeys, ...attachments.map((a) => a.fileKey), ...dispatches.flatMap((d) => [d.pdfKey, d.proofKey].filter((k): k is string => Boolean(k)))];
    report.documents += docIds.length;
    report.files += keys.length;
    const candidatePatients = [...new Set(old.map((d) => d.patientId).filter((p): p is string => Boolean(p)))];
    const outboxCutoff = new Date(Date.now() - r.outboxDays * 86_400_000);
    const auditCutoff = monthsAgo(r.auditMonths);
    if (opts.dryRun) {
      report.auditLogs += await collections().auditLogs().countDocuments({ organizationId: org._id, at: { $lt: auditCutoff } });
      report.outbox += await collections().outbox().countDocuments({ organizationId: org._id, createdAt: { $lt: outboxCutoff } });
      report.aiUsage += await collections().aiUsage().countDocuments({ organizationId: org._id, at: { $lt: auditCutoff } });
      continue;
    }
    for (const key of keys) await storage().delete(key).catch(() => undefined);
    await Promise.all([
      collections().secureLinks().deleteMany({ documentId: { $in: docIds } }),
      collections().dispatches().deleteMany({ documentId: { $in: docIds } }),
      collections().attachments().deleteMany({ documentId: { $in: docIds } }),
      collections().documents().deleteMany({ _id: { $in: docIds } }),
    ]);
    // Patients sans aucun document restant et sans activité récente.
    for (const pid of candidatePatients) {
      const remaining = await collections().documents().countDocuments({ patientId: pid });
      if (remaining === 0) {
        const res = await collections().patients().deleteOne({ _id: pid, updatedAt: { $lt: docCutoff } });
        report.patients += res.deletedCount;
      }
    }
    report.auditLogs += (await collections().auditLogs().deleteMany({ organizationId: org._id, at: { $lt: auditCutoff } })).deletedCount;
    report.outbox += (await collections().outbox().deleteMany({ organizationId: org._id, createdAt: { $lt: outboxCutoff } })).deletedCount;
    report.aiUsage += (await collections().aiUsage().deleteMany({ organizationId: org._id, at: { $lt: auditCutoff } })).deletedCount;
  }
  if (!opts.dryRun) {
    report.secureLinks += (await collections().secureLinks().deleteMany({ expiresAt: { $lt: new Date(Date.now() - 30 * 86_400_000) } })).deletedCount;
  }
  return report;
}
