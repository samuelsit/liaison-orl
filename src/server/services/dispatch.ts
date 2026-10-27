import "server-only";
import { randomUUID } from "node:crypto";
import { MongoServerError } from "mongodb";
import { appUrl } from "@/lib/env";
import { collections } from "@/lib/db/collections";
import type { CentreDoc, DispatchDoc, DocumentDoc, OrganizationDoc, PrescriberDoc } from "@/lib/db/types";
import { assertCan } from "@/lib/auth/permissions";
import type { UserContext } from "@/lib/auth/session";
import { centreDisplayName } from "@/lib/brand";
import { formatIsoDate, formatLongDate } from "@/lib/dates";
import { fr } from "@/lib/i18n/fr";
import { emailFr } from "@/lib/i18n/email";
import { initials, formatPersonName } from "@/lib/text";
import { isAddressComplete } from "@/lib/schemas/common";
import type { Channel, DispatchEvent } from "@/lib/schemas/dispatch";
import type { DeliveryProduct } from "@/lib/schemas/organization";
import { ACCESS_MARKER, renderSubject, renderTemplate, type TemplateVars } from "@/lib/dispatch/template";
import { isFrance } from "@/lib/postal/address";
import { postalAddress } from "@/lib/pdf/address";
import { documentFont } from "@/lib/brand";
import { renderPdf } from "@/lib/pdf/render";
import { UserFacingError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { emailBrand, renderEmail } from "@/server/emails/render";
import { accessCodeEmail, documentEmail } from "@/server/emails/document";
import { emailProvider } from "./email";
import { EmailSendError, emailErrorHint } from "./email/types";
import { postalProvider, PostalError, type PostalOptions } from "./postal";
import { explainPostalIssue } from "./postal/status-map";
import { actor, getDocumentForUser } from "./documents";
import { modelFromSnapshot } from "./pdf-model";
import { createSecureLink } from "./secure-links";
import { storage, storageKeys } from "./storage";
import { applyDispatchUpdate, syncDocumentStatus } from "./dispatch-status";
import { toPrescriberView, type PrescriberView } from "./prescribers";

/* ---------- Préparation (écran récapitulatif) ---------- */

export interface EmailPlan {
  available: boolean;
  to: string | null;
  subject: string;
  bodyText: string;
  mode: "secure-link" | "attachment";
  secondFactor: "birthdate" | "code";
  validityDays: number;
  copyToCentre: boolean;
  centreEmail: string;
  problem: string | null;
}

export interface PostalPlan {
  available: boolean;
  addressLines: string[];
  errors: string[];
  warnings: string[];
  options: PostalOptions;
  pages: number;
  estimate: { cents: number; currency: string } | null;
  mode: "live" | "mock";
}

export interface DispatchPlan {
  documentId: string;
  type: DocumentDoc["type"];
  version: number;
  patientLabel: string;
  prescriber: PrescriberView | null;
  email: EmailPlan;
  postal: PostalPlan;
  defaultChannels: Channel[];
}

interface Loaded {
  doc: DocumentDoc;
  org: OrganizationDoc;
  centre: CentreDoc;
  prescriber: PrescriberDoc | null;
}

async function load(ctx: UserContext, documentId: string): Promise<Loaded> {
  const doc = await getDocumentForUser(ctx, documentId);
  if (doc.status === "BROUILLON" || !doc.snapshot || !doc.pdfKey) throw new UserFacingError("Validez le document avant de l'envoyer.");
  const [centre, prescriber] = await Promise.all([
    collections().centres().findOne({ _id: doc.centreId, organizationId: doc.organizationId }),
    doc.prescriberId ? collections().prescribers().findOne({ _id: doc.prescriberId, organizationId: doc.organizationId }) : null,
  ]);
  if (!centre) throw new UserFacingError("Centre introuvable.");
  return { doc, org: ctx.organization, centre, prescriber };
}

function accessText(mode: EmailPlan["mode"], factor: EmailPlan["secondFactor"], days: number): string {
  if (mode === "attachment") return "Le document est joint à ce message au format PDF.";
  return factor === "code"
    ? `Pour consulter le document, cliquez sur le lien sécurisé puis saisissez le code d'accès reçu dans un second e-mail (lien valable ${days} jours).`
    : `Pour consulter le document, cliquez sur le lien sécurisé puis saisissez la date de naissance du patient (lien valable ${days} jours).`;
}

function templateVars(l: Loaded, access: string): TemplateVars {
  const s = l.doc.snapshot!;
  const p = s.patient;
  const salutation = s.prescriber?.salutation || l.org.settings.documents.defaultSalutation || "Cher(e) Docteur";
  const typeLabel = fr.documentTypes[l.doc.type];
  return {
    "document.type": typeLabel,
    "document.type_minuscule": typeLabel.charAt(0).toLowerCase() + typeLabel.slice(1),
    "document.date": formatIsoDate(l.doc.type === "ADRESSAGE" ? (l.doc.data as { date: string }).date : (l.doc.data as { reportDate: string }).reportDate),
    "patient.civilite": p.civility,
    "patient.nom": p.lastName.toLocaleUpperCase("fr-FR"),
    "patient.prenom": p.firstName,
    "patient.initiales": initials(p.firstName, p.lastName),
    "patient.nom_abrege": [p.firstName.trim() ? `${p.firstName.trim()[0]!.toUpperCase()}.` : "", p.lastName.trim().toLocaleUpperCase("fr-FR")].filter(Boolean).join(" "),
    "prescripteur.formule": salutation,
    "prescripteur.nom": s.prescriber ? `${s.prescriber.civility} ${formatPersonName(s.prescriber.firstName, s.prescriber.lastName)}` : "",
    "centre.nom": centreDisplayName(l.org.brand.name, l.centre.name),
    "centre.telephone": l.centre.phone,
    "centre.email": l.centre.email,
    "audioprothesiste.nom": formatPersonName(s.author.firstName, s.author.lastName),
    "audioprothesiste.titre": s.author.title,
    acces: access,
    validite: `${l.org.settings.email.linkValidityDays} jours`,
  };
}

async function countPdfPages(key: string): Promise<number> {
  const pdf = await storage().get(key);
  if (!pdf) return 1;
  return Math.max(1, (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length);
}

function postalDefaults(org: OrganizationDoc, override?: Partial<PostalOptions>): PostalOptions {
  const p = org.settings.postal;
  return {
    deliveryProduct: override?.deliveryProduct ?? p.deliveryProduct,
    printMode: override?.printMode ?? p.printMode,
    printSpectrum: override?.printSpectrum ?? p.printSpectrum,
    addressPosition: "right",
  };
}

export async function prepareDispatch(ctx: UserContext, documentId: string, postalOverride?: Partial<PostalOptions>, opts: { audit?: boolean } = {}): Promise<DispatchPlan> {
  assertCan(ctx.user, "document.send", ctx.organization.settings);
  const l = await load(ctx, documentId);
  const s = ctx.organization.settings.email;
  const email = l.prescriber?.email ?? "";
  const access = accessText(s.mode, s.secondFactor, s.linkValidityDays);
  const vars = templateVars(l, access);
  const needsBirthDate = s.mode === "secure-link" && s.secondFactor === "birthdate" && !l.doc.snapshot!.patient.birthDate;
  const emailPlan: EmailPlan = {
    available: Boolean(email) && !needsBirthDate,
    to: email || null,
    subject: renderSubject(s.subjectTemplate, vars),
    bodyText: renderTemplate(s.bodyTemplate, vars),
    mode: s.mode,
    secondFactor: s.secondFactor,
    validityDays: s.linkValidityDays,
    copyToCentre: s.copyToCentre,
    centreEmail: l.centre.email,
    problem: !email
      ? "Le prescripteur n'a pas d'adresse e-mail dans l'annuaire."
      : needsBirthDate
        ? "La date de naissance du patient est nécessaire pour protéger le lien sécurisé."
        : null,
  };
  const formatted = l.prescriber
    ? postalAddress(
        { civility: l.prescriber.civility, firstName: l.prescriber.firstName, lastName: l.prescriber.lastName, practiceName: l.prescriber.practiceName, address: l.prescriber.address },
        documentFont(l.org.brand.fonts.document),
      )
    : { lines: [], errors: ["Aucun prescripteur destinataire."], warnings: [] };
  const options = postalDefaults(ctx.organization, postalOverride);
  // La version postale a la même pagination que le document validé (adresse dans la fenêtre, sans page d'accompagnement).
  const pages = await countPdfPages(l.doc.pdfKey!);
  let estimate: PostalPlan["estimate"] = null;
  if (formatted.errors.length === 0) {
    try {
      estimate = await postalProvider().estimatePrice({ ...options, pages, country: isFrance(l.prescriber?.address.country ?? "FRANCE") ? "FR" : "FR" });
    } catch {
      estimate = null;
    }
  }
  const postalPlan: PostalPlan = {
    available: Boolean(l.prescriber) && isAddressComplete(l.prescriber?.address) && formatted.errors.length === 0,
    addressLines: formatted.lines,
    errors: formatted.errors,
    warnings: formatted.warnings,
    options,
    pages,
    estimate,
    mode: postalProvider().mode,
  };
  const preferred = l.prescriber?.preferredChannel ?? "email";
  const wanted: Channel[] = preferred === "both" ? ["EMAIL", "COURRIER"] : preferred === "courrier" ? ["COURRIER"] : ["EMAIL"];
  let defaults = wanted.filter((c) => (c === "EMAIL" ? emailPlan.available : postalPlan.available));
  if (defaults.length === 0) defaults = emailPlan.available ? ["EMAIL"] : postalPlan.available ? ["COURRIER"] : [];
  if (opts.audit !== false) await audit(actor(ctx), "dispatch.prepare", "document", l.doc._id);
  const p = l.doc.snapshot!.patient;
  return {
    documentId: l.doc._id,
    type: l.doc.type,
    version: l.doc.version,
    patientLabel: `${p.civility} ${formatPersonName(p.firstName, p.lastName)}`,
    prescriber: l.prescriber ? toPrescriberView(l.prescriber, ctx.user.id) : null,
    email: emailPlan,
    postal: postalPlan,
    defaultChannels: defaults,
  };
}

/* ---------- Envoi ---------- */

export interface SendInput {
  channels: Channel[];
  copyToCentre?: boolean;
  postal?: Partial<Pick<PostalOptions, "deliveryProduct" | "printMode" | "printSpectrum">>;
  batchId?: string | null;
  /** Renvoi explicite : crée une nouvelle tentative au lieu de rejouer la précédente. */
  resend?: boolean;
}

function event(type: string, status: DispatchDoc["status"], detail?: string): DispatchEvent {
  return { type, status, at: new Date(), source: "app", ...(detail ? { detail } : {}) };
}

async function nextAttempt(documentId: string, version: number, channel: Channel): Promise<number> {
  return (await collections().dispatches().countDocuments({ documentId, documentVersion: version, channel })) + 1;
}

async function insertDispatch(d: DispatchDoc): Promise<{ dispatch: DispatchDoc; duplicate: boolean }> {
  try {
    await collections().dispatches().insertOne(d);
    return { dispatch: d, duplicate: false };
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      const existing = await collections().dispatches().findOne({ idempotencyKey: d.idempotencyKey });
      if (existing) return { dispatch: existing, duplicate: true };
    }
    throw err;
  }
}

export async function sendDocument(ctx: UserContext, documentId: string, input: SendInput): Promise<DispatchDoc[]> {
  assertCan(ctx.user, "document.send", ctx.organization.settings);
  const channels = [...new Set(input.channels)];
  if (channels.length === 0) throw new UserFacingError("Choisissez au moins un canal d'envoi.");
  const l = await load(ctx, documentId);
  const results: DispatchDoc[] = [];
  for (const channel of channels) {
    const attempt = input.resend ? await nextAttempt(l.doc._id, l.doc.version, channel) : 1;
    const now = new Date();
    const prescriberName = l.prescriber ? `${l.prescriber.civility} ${formatPersonName(l.prescriber.firstName, l.prescriber.lastName)}` : "—";
    const base: DispatchDoc = {
      _id: randomUUID(),
      organizationId: l.doc.organizationId,
      centreId: l.doc.centreId,
      documentId: l.doc._id,
      documentVersion: l.doc.version,
      patientId: l.doc.patientId,
      prescriberId: l.doc.prescriberId,
      channel,
      recipient: {
        name: prescriberName,
        email: channel === "EMAIL" ? (l.prescriber?.email ?? null) : null,
        address: channel === "COURRIER" && l.prescriber ? { ...l.prescriber.address } : null,
      },
      status: "queued",
      provider: channel === "EMAIL" ? (emailProvider().mode === "live" ? "resend" : "mock-email") : postalProvider().mode === "live" ? "pingen" : "mock-postal",
      externalId: null,
      costCents: null,
      currency: null,
      options: {},
      idempotencyKey: `${l.doc._id}:v${l.doc.version}:${channel}:${attempt}`,
      error: null,
      events: [event("created", "queued")],
      secureLinkId: null,
      pdfKey: null,
      proofKey: null,
      createdBy: ctx.user.id,
      batchId: input.batchId ?? null,
      acknowledged: false,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      deliveredAt: null,
      openedAt: null,
    };
    const { dispatch, duplicate } = await insertDispatch(base);
    if (duplicate) {
      results.push(dispatch);
      continue;
    }
    await audit(actor(ctx), "dispatch.confirm", "dispatch", dispatch._id, { documentId: l.doc._id, channel, attempt });
    try {
      if (channel === "EMAIL") await sendEmail(l, dispatch, input.copyToCentre);
      else await sendPostal(l, dispatch, input.postal);
    } catch (err) {
      const e =
        err instanceof EmailSendError
          ? { code: err.code, message: "L'e-mail n'a pas pu être envoyé.", hint: emailErrorHint(err) }
          : err instanceof PostalError
            ? { code: err.code, message: err.message, hint: err.hint }
            : err instanceof UserFacingError
              ? { code: "invalid", message: err.message, hint: "" }
              : { code: "unknown", message: "Erreur inattendue lors de l'envoi.", hint: "Réessayez ; si le problème persiste, contactez le support." };
      if (!(err instanceof EmailSendError || err instanceof PostalError || err instanceof UserFacingError)) console.error(err);
      await applyDispatchUpdate(dispatch._id, { status: "failed", type: "error", source: "app", detail: e.message, error: e });
    }
    const fresh = await collections().dispatches().findOne({ _id: dispatch._id });
    if (fresh) results.push(fresh);
  }
  await syncDocumentStatus(l.doc._id);
  return results;
}

async function sendEmail(l: Loaded, dispatch: DispatchDoc, copyToCentreOverride?: boolean) {
  const s = l.org.settings.email;
  const to = dispatch.recipient.email;
  if (!to) throw new UserFacingError("Le prescripteur n'a pas d'adresse e-mail.");
  const pdf = await storage().get(l.doc.pdfKey!);
  if (!pdf) throw new UserFacingError("PDF du document introuvable : rouvrez puis validez à nouveau le document.");
  let link: string | null = null;
  let code: string | null = null;
  let expiresOn = "";
  if (s.mode === "secure-link") {
    const created = await createSecureLink({
      organizationId: l.doc.organizationId,
      dispatchId: dispatch._id,
      documentId: l.doc._id,
      pdfKey: l.doc.pdfKey!,
      secondFactor: s.secondFactor,
      birthDate: l.doc.snapshot!.patient.birthDate,
      validityDays: s.linkValidityDays,
    });
    link = `${appUrl()}/l/${created.token}`;
    code = created.code;
    expiresOn = formatLongDate(created.link.expiresAt);
    await collections().dispatches().updateOne({ _id: dispatch._id }, { $set: { secureLinkId: created.link._id } });
  }
  const vars = templateVars(l, ACCESS_MARKER);
  const body = renderTemplate(s.bodyTemplate, vars);
  const [before, after = ""] = body.includes(ACCESS_MARKER) ? body.split(ACCESS_MARKER) : [body, ""];
  const subject = renderSubject(s.subjectTemplate, { ...vars, acces: "" });
  const centreName = centreDisplayName(l.org.brand.name, l.centre.name);
  const brand = emailBrand(l.org, { displayName: centreName, centre: l.centre });
  const { html, text } = await renderEmail(
    documentEmail({
      brand,
      documentLabel: fr.documentTypes[l.doc.type],
      patientLabel: `${vars["patient.civilite"]} ${vars["patient.nom_abrege"]}`.trim(),
      before: before!.trim(),
      after: after.trim(),
      access: link
        ? { mode: "secure-link", link, factor: s.secondFactor, expiresOn, centrePhone: l.centre.phone }
        : { mode: "attachment" },
    }),
  );
  const copy = copyToCentreOverride ?? s.copyToCentre;
  const sent = await emailProvider().send({
    kind: "document",
    organizationId: l.doc.organizationId,
    fromName: centreName,
    to: [to],
    cc: copy && l.centre.email ? [l.centre.email] : [],
    replyTo: l.centre.email || null,
    subject,
    html,
    text,
    attachments: s.mode === "attachment" ? [{ filename: `${fr.documentTypes[l.doc.type].replace(/[^\p{L}]+/gu, "-").toLowerCase()}.pdf`, content: pdf, contentType: "application/pdf" }] : undefined,
    tags: { dispatch_id: dispatch._id },
    idempotencyKey: dispatch.idempotencyKey,
  });
  if (code) {
    const codeMail = await renderEmail(accessCodeEmail({ brand, code, expiresOn, sender: centreName }));
    await emailProvider().send({
      kind: "access-code",
      organizationId: l.doc.organizationId,
      fromName: centreName,
      to: [to],
      replyTo: l.centre.email || null,
      subject: emailFr.accessCode.title,
      html: codeMail.html,
      text: codeMail.text,
      idempotencyKey: `${dispatch.idempotencyKey}:code`,
    });
  }
  await collections()
    .dispatches()
    .updateOne({ _id: dispatch._id }, { $set: { externalId: sent.id, options: { mode: s.mode, secondFactor: s.secondFactor, copyToCentre: Boolean(copy) } } });
  await applyDispatchUpdate(dispatch._id, { status: "sent", type: "email.sent", source: "app" });
}

async function sendPostal(l: Loaded, dispatch: DispatchDoc, override?: SendInput["postal"]) {
  const prescriber = l.prescriber;
  if (!prescriber) throw new UserFacingError("Aucun prescripteur destinataire.");
  const formatted = postalAddress(
    { civility: prescriber.civility, firstName: prescriber.firstName, lastName: prescriber.lastName, practiceName: prescriber.practiceName, address: prescriber.address },
    documentFont(l.org.brand.fonts.document),
  );
  if (formatted.errors.length) throw new UserFacingError(formatted.errors.join(" "));
  const options = postalDefaults(l.org, override);
  const { buffer } = await renderPdf(modelFromSnapshot(l.org, l.centre, l.doc, { prescriberAddress: prescriber.address }), "postal");
  const key = storageKeys.dispatchPdf(l.doc.organizationId, dispatch._id);
  await storage().put(key, buffer, "application/pdf");
  await collections()
    .dispatches()
    .updateOne({ _id: dispatch._id }, { $set: { pdfKey: key, options: { ...options, confirmedByUser: true } } });
  const provider = postalProvider();
  let state = await provider.createLetter({
    pdf: buffer,
    fileName: `${l.doc.type === "ADRESSAGE" ? "adressage" : "compte-rendu"}-${dispatch._id.slice(0, 8)}.pdf`,
    options,
    idempotencyKey: dispatch.idempotencyKey,
    recipientCity: prescriber.address.city,
    recipientPostalCode: prescriber.address.postalCode,
  });
  await collections().dispatches().updateOne({ _id: dispatch._id }, { $set: { externalId: state.externalId } });
  // Pingen valide le PDF de façon asynchrone : on attend quelques secondes avant de déclencher l'envoi.
  for (let i = 0; i < 8 && state.status === "queued"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    state = await provider.getLetter(state.externalId);
  }
  if (state.status === "awaiting_confirmation") state = await provider.sendLetter(state.externalId, options, dispatch.idempotencyKey);
  await applyPostalState(dispatch._id, state);
}

/** Applique l'état renvoyé par le prestataire postal à un envoi. */
export async function applyPostalState(dispatchId: string, state: Awaited<ReturnType<ReturnType<typeof postalProvider>["getLetter"]>>, source: DispatchEvent["source"] = "app") {
  if (state.status === "action_required" || state.status === "failed" || state.status === "undeliverable") {
    const e = explainPostalIssue(state.issue);
    await applyDispatchUpdate(dispatchId, { status: state.status, type: `letter.${state.rawStatus}`, source, detail: state.issue ?? undefined, error: { code: state.rawStatus, ...e }, costCents: state.priceCents });
    return;
  }
  await applyDispatchUpdate(dispatchId, {
    status: state.status === "awaiting_confirmation" ? "queued" : state.status,
    type: `letter.${state.rawStatus}`,
    source,
    costCents: state.priceCents,
  });
  if (state.currency) await collections().dispatches().updateOne({ _id: dispatchId }, { $set: { currency: state.currency } });
}

/* ---------- Renvoi, annulation, erreurs ---------- */

async function getDispatchForUser(ctx: UserContext, id: string): Promise<DispatchDoc> {
  const d = await collections().dispatches().findOne({ _id: id, organizationId: ctx.user.organizationId });
  if (!d) throw new UserFacingError("Envoi introuvable.");
  if (ctx.user.role !== "admin" && !ctx.user.centreIds.includes(d.centreId)) throw new UserFacingError("Envoi introuvable.");
  return d;
}

export async function retryDispatch(ctx: UserContext, id: string): Promise<DispatchDoc[]> {
  assertCan(ctx.user, "document.send", ctx.organization.settings);
  const d = await getDispatchForUser(ctx, id);
  await collections().dispatches().updateOne({ _id: d._id }, { $set: { acknowledged: true } });
  await audit(actor(ctx), "dispatch.retry", "dispatch", d._id);
  return sendDocument(ctx, d.documentId, { channels: [d.channel], resend: true });
}

export async function cancelDispatch(ctx: UserContext, id: string) {
  assertCan(ctx.user, "document.send", ctx.organization.settings);
  const d = await getDispatchForUser(ctx, id);
  if (d.channel !== "COURRIER" || !["queued", "awaiting_confirmation", "sent", "action_required"].includes(d.status)) {
    throw new UserFacingError("Ce courrier ne peut plus être annulé (impression en cours ou terminée).");
  }
  if (d.externalId) await postalProvider().cancelLetter(d.externalId).catch(() => undefined);
  await applyDispatchUpdate(d._id, { status: "cancelled", type: "cancelled", source: "app" });
  await audit(actor(ctx), "dispatch.cancel", "dispatch", d._id);
}

export async function acknowledgeDispatch(ctx: UserContext, id: string) {
  assertCan(ctx.user, "document.send", ctx.organization.settings);
  const d = await getDispatchForUser(ctx, id);
  await collections().dispatches().updateOne({ _id: d._id }, { $set: { acknowledged: true, updatedAt: new Date() } });
  await syncDocumentStatus(d.documentId);
}

/* ---------- Envoi groupé ---------- */

export interface BulkResult {
  documentId: string;
  ok: boolean;
  channels: Channel[];
  message: string;
}

/** Envoie plusieurs documents validés selon le canal préféré de chaque prescripteur. */
export async function bulkSend(ctx: UserContext, documentIds: string[], options: { deliveryProduct?: DeliveryProduct } = {}): Promise<BulkResult[]> {
  assertCan(ctx.user, "document.send", ctx.organization.settings);
  const batchId = randomUUID();
  await collections().dispatchBatches().insertOne({ _id: batchId, organizationId: ctx.user.organizationId, createdBy: ctx.user.id, documentIds, createdAt: new Date() });
  const results: BulkResult[] = [];
  for (const id of documentIds.slice(0, 100)) {
    try {
      const plan = await prepareDispatch(ctx, id, undefined, { audit: false });
      if (plan.defaultChannels.length === 0) {
        results.push({ documentId: id, ok: false, channels: [], message: plan.email.problem ?? plan.postal.errors[0] ?? "Aucun canal d'envoi disponible." });
        continue;
      }
      const sent = await sendDocument(ctx, id, { channels: plan.defaultChannels, batchId, postal: options.deliveryProduct ? { deliveryProduct: options.deliveryProduct } : undefined });
      const failed = sent.filter((d) => d.error);
      results.push({
        documentId: id,
        ok: failed.length === 0,
        channels: plan.defaultChannels,
        message: failed.length ? failed.map((d) => d.error!.message).join(" ") : `${plan.patientLabel} : ${plan.defaultChannels.map((c) => fr.channels[c]).join(" + ")}`,
      });
    } catch (err) {
      results.push({ documentId: id, ok: false, channels: [], message: err instanceof Error ? err.message : "Erreur" });
    }
  }
  return results;
}
