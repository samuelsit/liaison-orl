"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CloudOff, Download, Loader2, Pencil, Send, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shortcut } from "@/components/ui/shortcut";
import { DocumentStatusBadge } from "@/components/documents/status-badge";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { PrintPdfButton, pdfUrls, startPrint } from "@/components/documents/print-pdf";
import { useAutosave, readBackup, clearBackup } from "@/hooks/use-autosave";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useIsMobile } from "@/hooks/use-mobile";
import { deleteDocumentAction, reopenDocumentAction, validateDocumentAction } from "@/server/actions/documents";
import { isSendableType, type DocumentData, type DocumentStatus, type DocumentType } from "@/lib/schemas/document";
import type { PatientView } from "@/server/services/patients";
import type { PrescriberView } from "@/server/services/prescribers";
import { formatRelative } from "@/lib/dates";
import { fr } from "@/lib/i18n/fr";
import { docFr } from "@/lib/i18n/documents";
import { EditorContext, type EditorContextValue, type EditorShared } from "./editor-context";
import { AdressageFields } from "./adressage-fields";
import { CompteRenduFields } from "./compte-rendu-fields";
import { BilanPanel, type AttachmentView } from "./bilan-panel";
import { MotifAssistant } from "./motif-assistant";
import { CommentAssistant } from "./comment-assistant";

const T = docFr.editor;

export interface EditorDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  version: number;
  updatedAt: string;
  data: DocumentData;
  aiFields: string[];
  authorName: string;
}

export function DocumentEditor({
  doc,
  initialPatient,
  initialPrescriber,
  shared,
  permissions,
  attachments,
}: {
  doc: EditorDocument;
  initialPatient: PatientView | null;
  initialPrescriber: PrescriberView | null;
  shared: EditorShared;
  permissions: { canValidate: boolean; canSend: boolean; canDelete: boolean };
  attachments: AttachmentView[];
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [data, setData] = useState<DocumentData>(doc.data);
  const [patient, setPatientState] = useState<PatientView | null>(initialPatient);
  const [prescriber, setPrescriberState] = useState<PrescriberView | null>(initialPrescriber);
  const [aiFields, setAiFields] = useState<string[]>(doc.aiFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<null | { kind: "ai" | "warnings" | "reopen" | "delete"; warnings?: string[] }>(null);
  const [pending, startTransition] = useTransition();
  const readOnly = doc.status !== "BROUILLON";
  // Le courrier d'adressage s'imprime ou se télécharge ; seul le compte rendu s'envoie.
  const sendable = isSendableType(doc.type);
  const canSend = sendable && permissions.canSend;
  const pdf = pdfUrls(doc.id);

  const payloadObj = useMemo(() => ({ data, patientId: patient?.id ?? null, prescriberId: prescriber?.id ?? null, aiFields }), [data, patient, prescriber, aiFields]);
  const payload = useMemo(() => JSON.stringify(payloadObj), [payloadObj]);
  const initialPayload = useMemo(
    () => JSON.stringify({ data: doc.data, patientId: initialPatient?.id ?? null, prescriberId: initialPrescriber?.id ?? null, aiFields: doc.aiFields }),
    [doc.data, doc.aiFields, initialPatient, initialPrescriber],
  );
  const { state: saveState, savedAt, flush } = useAutosave(doc.id, payload, !readOnly, initialPayload);

  // Récupération d'une saisie locale plus récente que le serveur (coupure réseau, fermeture brutale).
  useEffect(() => {
    if (readOnly) return;
    const backup = readBackup(doc.id);
    if (!backup || backup.at <= new Date(doc.updatedAt).getTime() || backup.payload === initialPayload) {
      if (backup) clearBackup(doc.id);
      return;
    }
    try {
      const restored = JSON.parse(backup.payload) as { data: DocumentData; aiFields: string[] };
      const id = requestAnimationFrame(() => {
        setData(restored.data);
        setAiFields(restored.aiFields ?? []);
        toast.info(T.restored);
      });
      return () => cancelAnimationFrame(id);
    } catch {
      clearBackup(doc.id);
    }
  }, [doc.id, doc.updatedAt, initialPayload, readOnly]);

  // Aperçu : rendu après une courte pause de saisie.
  const [previewBody, setPreviewBody] = useState(payload);
  useEffect(() => {
    const t = setTimeout(() => setPreviewBody(payload), 450);
    return () => clearTimeout(t);
  }, [payload]);
  // ?debug=pingen : aperçu de la version postale avec les zones Pingen superposées (compte rendu seulement).
  const [pingenDebug] = useState(() => sendable && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "pingen");
  const previewRequest = useMemo(
    () =>
      pingenDebug
        ? { method: "POST" as const, url: `/api/documents/${doc.id}/apercu?variant=postal&debug=pingen`, body: previewBody }
        : readOnly
          ? { method: "GET" as const, url: `/api/documents/${doc.id}/pdf?v=${doc.version}` }
          : { method: "POST" as const, url: `/api/documents/${doc.id}/apercu`, body: previewBody },
    [pingenDebug, readOnly, doc.id, doc.version, previewBody],
  );

  const clearErrors = (keys: string[]) =>
    setErrors((e) => {
      if (!keys.some((k) => k in e)) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });

  const ctx: EditorContextValue = {
    documentId: doc.id,
    data,
    readOnly,
    errors,
    aiFields,
    patient,
    prescriber,
    shared,
    update: (patch) => {
      if (readOnly) return;
      setData((d) => ({ ...d, ...patch }) as DocumentData);
      const keys = Object.keys(patch);
      setAiFields((f) => f.filter((x) => !keys.includes(x)));
      clearErrors([...keys, ...(keys.includes("exams") ? ["exams"] : [])]);
    },
    suggest: (patch, fields) => {
      if (readOnly) return;
      setData((d) => ({ ...d, ...patch }) as DocumentData);
      setAiFields((f) => [...new Set([...f, ...fields])]);
      clearErrors(Object.keys(patch));
    },
    acceptAi: (field) => setAiFields((f) => f.filter((x) => x !== field)),
    setPatient: (p) => {
      setPatientState(p);
      clearErrors(["patientId", "patientBirthDate"]);
    },
    setPrescriber: (p) => {
      setPrescriberState(p);
      clearErrors(["prescriberId"]);
    },
  };

  const runValidate = useCallback(
    (skipChecks: boolean) => {
      if (!permissions.canValidate) return;
      if (!skipChecks && aiFields.length > 0) return setDialog({ kind: "ai" });
      startTransition(async () => {
        await flush();
        const res = await validateDocumentAction(doc.id);
        if (!res.ok) return void toast.error(res.error);
        if ("errors" in res.data) {
          setErrors(res.data.errors);
          toast.error(T.missingTitle, { description: Object.values(res.data.errors).slice(0, 3).join(" ") });
          return;
        }
        clearBackup(doc.id);
        toast.success(T.validated(res.data.version), {
          action: !sendable
            ? { label: T.print, onClick: () => void startPrint(pdf.inline) }
            : canSend
              ? { label: T.send, onClick: () => router.push(`/documents/${doc.id}/envoi`) }
              : undefined,
        });
        router.refresh();
      });
    },
    [aiFields.length, canSend, doc.id, flush, pdf.inline, permissions.canValidate, router, sendable],
  );

  useHotkeys(
    {
      "mod+s": (e) => {
        e.preventDefault();
        void flush().then(() => toast.success(fr.common.saved));
      },
      "mod+enter": (e) => {
        e.preventDefault();
        if (!readOnly) runValidate(false);
      },
    },
    [flush, readOnly, runValidate],
  );

  const form =
    doc.type === "ADRESSAGE" ? (
      <AdressageFields motifAssistant={!readOnly && shared.aiEnabled ? <MotifAssistant /> : null} />
    ) : (
      <CompteRenduFields
        bilan={<BilanPanel attachments={attachments} />}
        commentAssistant={!readOnly && shared.aiEnabled ? <CommentAssistant attachments={attachments} /> : null}
      />
    );

  const preview = (
    <PdfPreview
      request={previewRequest}
      label={fr.documentTypes[doc.type]}
      downloadUrl={pdf.download}
    />
  );

  return (
    <EditorContext.Provider value={ctx}>
      <div className="mx-auto max-w-[1500px]">
        <div className="sticky top-14 z-10 -mx-4 mb-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
              <ArrowLeft className="size-4" aria-hidden /> {T.back}
            </Link>
            <h1 className="text-lg font-bold text-brand-fg sm:text-xl">{fr.documentTypes[doc.type]}</h1>
            <DocumentStatusBadge status={doc.status} />
            {doc.version > 0 ? <span className="text-xs text-muted-foreground">v{doc.version}</span> : null}
            {!readOnly ? <SaveIndicator state={saveState} savedAt={savedAt} /> : null}
            <div className="ml-auto flex flex-wrap gap-2">
              {!readOnly && permissions.canDelete ? (
                <Button variant="ghost" className="text-destructive" onClick={() => setDialog({ kind: "delete" })} aria-label={T.delete}>
                  <Trash2 aria-hidden />
                  <span className="hidden md:inline">{T.delete}</span>
                </Button>
              ) : null}
              {readOnly ? (
                <>
                  {permissions.canValidate ? (
                    <Button variant="outline" onClick={() => setDialog({ kind: "reopen" })}>
                      <Pencil aria-hidden /> {T.reopen}
                    </Button>
                  ) : null}
                  {!sendable ? (
                    <>
                      <Button variant="outline" asChild data-testid="download-pdf">
                        <a href={pdf.download} download>
                          <Download aria-hidden /> {T.download}
                        </a>
                      </Button>
                      <PrintPdfButton url={pdf.inline} data-testid="print-pdf" />
                    </>
                  ) : canSend ? (
                    <Button asChild data-testid="prepare-send">
                      <Link href={`/documents/${doc.id}/envoi`}>
                        <Send aria-hidden /> {T.send}
                      </Link>
                    </Button>
                  ) : null}
                </>
              ) : permissions.canValidate ? (
                <Button onClick={() => runValidate(false)} disabled={pending} data-testid="validate">
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
                  {pending ? T.validating : T.validate}
                  <Shortcut keys={["mod", "enter"]} className="ml-1 hidden lg:inline-flex" />
                </Button>
              ) : (
                <span className="self-center text-sm text-muted-foreground">Brouillon prêt pour validation par un audioprothésiste</span>
              )}
            </div>
          </div>
        </div>

        {readOnly ? (
          <Alert className="mb-4">
            <CheckCircle2 aria-hidden />
            <AlertDescription>{sendable ? T.readOnly : T.readOnlyAdressage}</AlertDescription>
          </Alert>
        ) : null}
        {Object.keys(errors).length > 0 ? (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert aria-hidden />
            <AlertTitle>{T.missingTitle}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {Object.values(errors).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {isMobile ? (
          <Tabs defaultValue={readOnly && !sendable ? "preview" : "form"}>
            <TabsList className="mb-3 grid w-full grid-cols-2">
              <TabsTrigger value="form">
                {T.tabsForm}
              </TabsTrigger>
              <TabsTrigger value="preview">
                {T.tabsPreview}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="form">{form}</TabsContent>
            <TabsContent value="preview" forceMount className="data-[state=inactive]:hidden">
              {preview}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div>{form}</div>
            <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto" aria-label="Aperçu du PDF">
              {preview}
            </aside>
          </div>
        )}
      </div>

      <AlertDialog open={dialog?.kind === "ai"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T.aiTitle}</AlertDialogTitle>
            <AlertDialogDescription>{T.aiConfirm(aiFields.length)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDialog(null);
                runValidate(true);
              }}
            >
              {T.aiConfirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.kind === "reopen"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T.reopen}</AlertDialogTitle>
            <AlertDialogDescription>{T.reopenConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const res = await reopenDocumentAction(doc.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(T.reopened);
                  router.refresh();
                })
              }
            >
              {T.reopen}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.kind === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T.delete}</AlertDialogTitle>
            <AlertDialogDescription>{T.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteDocumentAction(doc.id);
                  if (!res.ok) return void toast.error(res.error);
                  clearBackup(doc.id);
                  toast.success(T.deleted);
                  router.replace("/");
                })
              }
            >
              {fr.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditorContext.Provider>
  );
}

function SaveIndicator({ state, savedAt }: { state: ReturnType<typeof useAutosave>["state"]; savedAt: Date | null }) {
  const label =
    state === "saved"
      ? savedAt
        ? `${T.save.saved} · ${formatRelative(savedAt)}`
        : T.save.saved
      : T.save[state];
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs ${state === "error" || state === "offline" ? "text-warning-foreground" : "text-muted-foreground"}`} data-testid="save-state">
      {state === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : state === "offline" || state === "error" ? <CloudOff className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}
