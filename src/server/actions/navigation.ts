"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACTIVE_CENTRE_COOKIE, accessibleCentres, getUserContextOrThrow, requireUserOrThrow } from "@/lib/auth/session";
import { collections } from "@/lib/db/collections";
import { prefixWordsRegex } from "@/lib/text";
import { fr } from "@/lib/i18n/fr";
import { shellFr } from "@/lib/i18n/shell";
import type { DocumentStatus, DocumentType } from "@/lib/schemas/document";
import { hydrateDocuments, type DocumentListItem } from "@/server/services/hydrate";
import { runAction, UserFacingError, type ActionResult } from "./result";

export async function setActiveCentreAction(centreId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUserOrThrow();
    const id = z.string().min(1).parse(centreId);
    const centres = await accessibleCentres(user);
    if (!centres.some((c) => c._id === id)) throw new UserFacingError("Ce centre ne fait pas partie de vos centres.");
    (await cookies()).set(ACTIVE_CENTRE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    await collections().users().updateOne({ _id: user.id }, { $set: { "preferences.activeCentreId": id } });
    revalidatePath("/", "layout");
    return undefined;
  });
}

export interface SearchHit {
  kind: "patient" | "prescriber" | "document";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Documents : type, statut, nom du patient et date de mise à jour (ISO). */
  docType?: DocumentType;
  status?: DocumentStatus;
  patientName?: string | null;
  updatedAt?: string;
  /** Prescripteurs : civilité (« Dr », « Pr »…) pour formuler « Adresser un patient au Dr … ». */
  civility?: string;
}

function documentHit(d: DocumentListItem): SearchHit {
  return {
    kind: "document",
    id: d.id,
    title: shellFr.palette.documentTitle(fr.documentTypesShort[d.type], d.patientName),
    subtitle: d.prescriberName ?? shellFr.palette.noPrescriber,
    href: `/documents/${d.id}`,
    docType: d.type,
    status: d.status,
    patientName: d.patientName,
    updatedAt: d.updatedAt,
  };
}

/** Recherche transverse de la palette de commandes (patients, ORL, documents). */
export async function globalSearchAction(query: string): Promise<SearchHit[]> {
  const ctx = await getUserContextOrThrow();
  const regex = prefixWordsRegex(query.slice(0, 80));
  if (!regex) return [];
  const centreIds = ctx.centres.map((c) => c._id);
  const [patients, prescribers] = await Promise.all([
    collections()
      .patients()
      .find({ organizationId: ctx.user.organizationId, centreId: { $in: centreIds }, searchText: regex })
      .limit(6)
      .toArray(),
    collections()
      .prescribers()
      .find({ organizationId: ctx.user.organizationId, archived: false, searchText: regex })
      .limit(6)
      .toArray(),
  ]);
  const docs = patients.length
    ? await collections()
        .documents()
        .find({ organizationId: ctx.user.organizationId, centreId: { $in: centreIds }, patientId: { $in: patients.map((p) => p._id) } })
        .sort({ updatedAt: -1 })
        .limit(6)
        .toArray()
    : [];
  const docItems = await hydrateDocuments(docs);
  return [
    ...patients.map<SearchHit>((p) => ({
      kind: "patient",
      id: p._id,
      title: `${p.civility} ${p.lastName.toUpperCase()} ${p.firstName}`,
      subtitle: p.birthDate ? `Né(e) le ${p.birthDate.split("-").reverse().join("/")}` : "Patient",
      href: `/patients/${p._id}`,
    })),
    ...prescribers.map<SearchHit>((p) => ({
      kind: "prescriber",
      id: p._id,
      title: `${p.civility} ${p.firstName} ${p.lastName.toUpperCase()}`.replace(/\s+/g, " "),
      subtitle: [p.specialty, p.practiceName, p.address.city].filter(Boolean).join(" · "),
      href: `/prescripteurs/${p._id}`,
      civility: p.civility,
    })),
    ...docItems.map(documentHit),
  ];
}

/** Documents récents de l'utilisateur (palette ouverte sans saisie) : lecture seule, centres accessibles. */
export async function recentItemsAction(): Promise<SearchHit[]> {
  const ctx = await getUserContextOrThrow();
  const centreIds = ctx.centres.map((c) => c._id);
  const docs = await collections()
    .documents()
    .find({ organizationId: ctx.user.organizationId, centreId: { $in: centreIds }, authorId: ctx.user.id })
    .sort({ updatedAt: -1 })
    .limit(5)
    .toArray();
  return (await hydrateDocuments(docs)).map(documentHit);
}
