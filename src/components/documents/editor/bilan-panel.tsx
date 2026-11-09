"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { deleteAttachmentAction, extractBilanAction, rebuildBilanAction, saveBilanAction, setAttachmentConditionAction } from "@/server/actions/ai";
import { emptyAudiometry, type Audiometry, type BilanCondition, type Conflict, type MeasureRef } from "@/lib/schemas/audiometry";
import { MAX_BILAN_BYTES, MAX_BILANS_PER_DOCUMENT, type AttachmentView } from "@/lib/schemas/attachment";
import type { BilanView, CompteRenduData } from "@/lib/schemas/document";
import { countAllMeasures } from "@/lib/audiology/calculations";
import { resolveConflict } from "@/lib/audiology/merge";
import { getMeasure } from "@/lib/audiology/refs";
import { docFr } from "@/lib/i18n/documents";
import { fr } from "@/lib/i18n/fr";
import { crFr } from "@/lib/i18n/compte-rendu";
import { useEditor } from "./editor-context";
import { EditorSection } from "./section";
import { useCompteRenduUi } from "./bilan/cr-context";
import { BilanDropOverlay, BilanDropzone, BilanProgress, type UploadJob } from "./bilan/bilan-upload";
import { BilanFileList } from "./bilan/bilan-file-list";
import { BilanReviewDialog } from "./bilan/bilan-review-dialog";
import { BilanSummary } from "./bilan/bilan-summary";

const B = crFr.bilan;
const PARALLEL = 3;

/** Réduit les photos lourdes avant l'envoi (bord long 2400 px, JPEG). */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || (file.size < 1_500_000 && file.type !== "image/heic")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

const isBilanFile = (f: File) => !f.type || f.type.startsWith("image/") || f.type === "application/pdf";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Amène une section à l'écran et place le focus sur son titre. */
function revealSection(section: Element | null) {
  if (!section) return;
  section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  const title = section.querySelector<HTMLElement>("h2");
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}

/** Première section après le bilan encore incomplète. */
function nextIncompleteSection(): Element | null {
  const sections = Array.from(document.querySelectorAll("[data-editor-section]"));
  const from = sections.findIndex((s) => s.id === "sec-bilan");
  return sections.slice(from + 1).find((s) => s.getAttribute("data-section-status") !== "complete") ?? null;
}

/** Exécute des tâches avec au plus `limit` en parallèle. */
async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  });
  await Promise.all(workers);
}

/**
 * Bilan auditif du compte rendu : plusieurs fichiers (tonale, vocale, mesures avec
 * appareils…), lus en parallèle par l'IA puis fusionnés en code en une seule audiométrie
 * que l'audioprothésiste vérifie et confirme. Le bilan fusionné vit sur le document
 * (`bilan`), hors du formulaire sauvegardé automatiquement.
 */
export function BilanPanel({ attachments, initialBilan }: { attachments: AttachmentView[]; initialBilan: BilanView | null }) {
  const ed = useEditor<CompteRenduData>();
  const cr = useCompteRenduUi();
  const ro = ed.readOnly;
  const [files, setFiles] = useState<AttachmentView[]>(() => [...attachments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  const [bilan, setBilanState] = useState<BilanView | null>(initialBilan);
  const [audiometry, setAudiometry] = useState<Audiometry | null>(initialBilan?.audiometry ?? null);
  const [conflicts, setConflicts] = useState<Conflict[]>(initialBilan?.conflicts ?? []);
  const [confirmed, setConfirmed] = useState(Boolean(initialBilan?.confirmed));
  const [wasConfirmed, setWasConfirmed] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ask, setAsk] = useState<AttachmentView | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<Audiometry | null>(null);
  const afterConfirm = useRef<Element | null | false>(false);
  const busy = jobs.length > 0 || merging;
  const { setBilan: publish, setOpenReview } = cr;
  const canAdd = files.length + jobs.length < MAX_BILANS_PER_DOCUMENT;

  /** Applique un bilan renvoyé par le serveur (recalcul, confirmation, retrait…). */
  const applyBilan = useCallback((b: BilanView | null) => {
    pendingSave.current = null;
    setBilanState(b);
    setAudiometry(b?.audiometry ?? null);
    setConflicts(b?.conflicts ?? []);
    setConfirmed(Boolean(b?.confirmed));
  }, []);

  // Publie l'état du bilan pour le reste du formulaire (degré conseillé, état des sections, commentaire, aperçu).
  useEffect(() => {
    publish({ audiometry, confirmed, updatedAt: bilan?.updatedAt ?? null, fileCount: files.length, conflicts: conflicts.length });
  }, [audiometry, confirmed, bilan?.updatedAt, files.length, conflicts.length, publish]);

  useEffect(() => {
    setOpenReview(audiometry ? () => setReviewOpen(true) : null);
    return () => setOpenReview(null);
  }, [audiometry, setOpenReview]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const a = pendingSave.current;
    pendingSave.current = null;
    if (a) {
      void saveBilanAction(ed.documentId, a, confirmed).then((res) => {
        if (res.ok) {
          setBilanState(res.data.bilan);
          setConflicts(res.data.bilan.conflicts);
        }
      });
    }
  }, [confirmed, ed.documentId]);

  // Enregistre une correction en attente si l'éditeur est quitté.
  const flushRef = useRef(flushSave);
  useEffect(() => {
    flushRef.current = flushSave;
  });
  useEffect(() => () => flushRef.current(), []);

  const updateFile = useCallback((next: AttachmentView) => setFiles((fs) => (fs.some((f) => f.id === next.id) ? fs.map((f) => (f.id === next.id ? next : f)) : [...fs, next])), []);

  /** Recalcule la fusion après un changement de fichiers ; lève la confirmation. */
  const rebuild = useCallback(async () => {
    setMerging(true);
    const res = await rebuildBilanAction(ed.documentId);
    setMerging(false);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    if (confirmed) setWasConfirmed(true);
    applyBilan(res.data);
    ed.refreshPreview();
    return res.data;
  }, [applyBilan, confirmed, ed]);

  const addFiles = useCallback(
    async (raw: File[]) => {
      if (ro || !raw.length) return;
      setError(null);
      const accepted: File[] = [];
      for (const f of raw) {
        if (!isBilanFile(f)) {
          toast.error(B.unsupportedNamed(f.name));
          continue;
        }
        const file = await compressImage(f);
        if (file.size > MAX_BILAN_BYTES) {
          toast.error(B.tooLargeNamed(f.name));
          continue;
        }
        accepted.push(file);
      }
      const room = MAX_BILANS_PER_DOCUMENT - files.length - jobs.length;
      if (accepted.length > room) toast.error(B.tooMany(MAX_BILANS_PER_DOCUMENT));
      const batch = accepted.slice(0, Math.max(0, room));
      if (!batch.length) return;
      // Ouverture automatique de la vérification, sauf si l'utilisateur a continué à saisir entre-temps.
      let interacted = false;
      const onInput = (e: Event) => {
        if (!(e.target instanceof HTMLInputElement && e.target.type === "file")) interacted = true;
      };
      document.addEventListener("input", onInput, true);
      const newJobs: UploadJob[] = batch.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, step: "uploading" }));
      setJobs((j) => [...j, ...newJobs]);
      const setStep = (key: string, patch: Partial<UploadJob>) => setJobs((j) => j.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      let read = 0;
      let failed = 0;
      try {
        await runLimited(newJobs, PARALLEL, async (job) => {
          const form = new FormData();
          form.append("fichier", job.file);
          const res = await fetch(`/api/documents/${ed.documentId}/bilan`, { method: "POST", body: form });
          const json = (await res.json().catch(() => ({}))) as AttachmentView & { error?: string };
          if (!res.ok) {
            failed++;
            return setStep(job.key, { step: "error", error: json.error ?? B.uploadFailed });
          }
          updateFile(json);
          setStep(job.key, { step: "reading" });
          const t = setTimeout(() => setStep(job.key, { step: "extracting" }), 1400);
          const ex = await extractBilanAction(json.id);
          clearTimeout(t);
          if (!ex.ok) {
            failed++;
            updateFile({ ...json, extractionStatus: "failed", extractionError: ex.error });
            return setStep(job.key, { step: "error", error: ex.error });
          }
          read++;
          updateFile(ex.data);
          setStep(job.key, { step: "done", measures: ex.data.extraction ? countAllMeasures(ex.data.extraction) : 0 });
        });
        const merged = read > 0 ? await rebuild() : null;
        if (merged?.audiometry) {
          const n = countAllMeasures(merged.audiometry);
          const summary = B.extracted(n, read) + (merged.conflicts.length ? B.extractedWithConflicts(merged.conflicts.length) : "");
          if (!interacted) setReviewOpen(true);
          else toast.success(summary, { action: { label: B.reviewAction, onClick: () => setReviewOpen(true) } });
        }
        if (failed) toast.error(B.someFailed(failed));
      } finally {
        document.removeEventListener("input", onInput, true);
        setJobs((j) => j.filter((x) => !newJobs.some((n) => n.key === x.key)));
      }
    },
    [ed.documentId, files.length, jobs.length, rebuild, ro, updateFile],
  );

  // Coller des captures (Ctrl/⌘ + V) hors d'un champ de saisie.
  useEffect(() => {
    if (ro || busy || reviewOpen) return;
    function onPaste(e: ClipboardEvent) {
      const pasted = [...(e.clipboardData?.files ?? [])].filter(isBilanFile);
      if (pasted.length && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        void addFiles(pasted);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles, busy, reviewOpen, ro]);

  function changeAudiometry(a: Audiometry) {
    setAudiometry(a);
    if (ro) return;
    // Une cellule corrigée à la main (sans provenance) n'est plus en conflit.
    setConflicts((cs) => cs.filter((c) => getMeasure(a, c.ref)?.source === c.kept.attachmentId));
    pendingSave.current = a;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 1000);
  }

  function onResolveConflict(ref: MeasureRef, attachmentId: string) {
    if (!audiometry) return;
    const next = resolveConflict({ audiometry, conflicts }, ref, attachmentId);
    setAudiometry(next.audiometry);
    setConflicts(next.conflicts);
    pendingSave.current = next.audiometry;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 400);
    toast.success(B.conflicts.resolved);
  }

  async function setCondition(file: AttachmentView, condition: BilanCondition) {
    if (file.condition === condition) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    setMerging(true);
    const res = await setAttachmentConditionAction(file.id, condition);
    setMerging(false);
    if (!res.ok) return void toast.error(res.error);
    if (confirmed) setWasConfirmed(true);
    updateFile(res.data.attachment);
    applyBilan(res.data.bilan);
    ed.refreshPreview();
    toast.success(B.conditionChanged);
  }

  async function reread(file: AttachmentView) {
    setJobs((j) => [...j, { key: `reread-${file.id}`, file: new File([], file.fileName, { type: file.mimeType }), step: "reading" }]);
    const ex = await extractBilanAction(file.id);
    setJobs((j) => j.filter((x) => x.key !== `reread-${file.id}`));
    if (!ex.ok) {
      updateFile({ ...file, extractionStatus: "failed", extractionError: ex.error });
      return void toast.error(ex.error);
    }
    updateFile(ex.data);
    await rebuild();
    toast.success(B.reread_done);
  }

  async function remove(file: AttachmentView) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    setMerging(true);
    const res = await deleteAttachmentAction(file.id);
    setMerging(false);
    if (!res.ok) return void toast.error(res.error);
    setFiles((fs) => fs.filter((f) => f.id !== file.id));
    if (confirmed) setWasConfirmed(true);
    applyBilan(res.data);
    ed.refreshPreview();
    toast.success(B.removed);
  }

  async function confirm() {
    if (!audiometry || confirming) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    setConfirming(true);
    const res = await saveBilanAction(ed.documentId, audiometry, true);
    setConfirming(false);
    if (!res.ok) return void toast.error(res.error);
    const again = confirmed;
    applyBilan(res.data.bilan);
    setWasConfirmed(false);
    ed.refreshPreview();
    const sug = res.data.suggestion;
    const patch: Partial<CompteRenduData> = {};
    const fields: string[] = [];
    if (sug) {
      if (sug.degree && (ed.data.degree === null || ed.aiFields.includes("degree"))) {
        patch.degree = sug.degree;
        patch.degreeRule = sug.rule;
        fields.push("degree");
      }
      if (sug.ears && (ed.data.ears === null || ed.aiFields.includes("ears"))) {
        patch.ears = sug.ears;
        fields.push("ears");
      }
      if (fields.length) ed.suggest(patch, fields);
    }
    toast.success(again ? B.correctionsSaved : B.confirmed);
    afterConfirm.current = fields.length ? document.getElementById("sec-patient") : nextIncompleteSection();
    setReviewOpen(false);
    if (!ed.data.comments.trim() && ed.shared.aiEnabled) {
      void cr.comment.run("standard", {
        data: { degree: patch.degree ?? ed.data.degree, ears: patch.ears ?? ed.data.ears },
        bilanRevision: res.data.bilan.updatedAt,
        auto: true,
      });
    }
  }

  function openManual() {
    if (!audiometry) setAudiometry(emptyAudiometry());
    setReviewOpen(true);
  }

  const status = confirmed ? "complete" : "incomplete";
  const showSummary = Boolean(audiometry) || files.length > 0;

  return (
    <EditorSection
      title={docFr.sections.bilan}
      id="sec-bilan"
      step={2}
      status={status}
      description={!showSummary && !ro ? crFr.sections.bilanDescription : undefined}
    >
      {error && !busy ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {jobs.length ? <BilanProgress jobs={jobs} merging={merging} /> : null}

      {!showSummary && !busy ? (
        ro ? (
          <p className="text-meta text-muted-foreground">{B.noBilan}</p>
        ) : (
          <BilanDropzone onChoose={() => fileInput.current?.click()} onCamera={() => cameraInput.current?.click()} onManual={openManual} />
        )
      ) : null}

      {showSummary && audiometry ? (
        <BilanSummary
          audiometry={audiometry}
          confirmed={confirmed}
          wasConfirmed={wasConfirmed}
          readOnly={ro}
          fileCount={files.length}
          conflicts={conflicts.length}
          commentPending={cr.comment.pending !== null && !ro}
          onOpenReview={() => setReviewOpen(true)}
        />
      ) : null}

      {files.length || (showSummary && !ro) ? (
        <BilanFileList
          files={files}
          readOnly={ro}
          busy={busy}
          canAdd={canAdd}
          onAdd={() => fileInput.current?.click()}
          onAddPhoto={() => cameraInput.current?.click()}
          onSetCondition={(f, c) => void setCondition(f, c)}
          onReread={(f) => void reread(f)}
          onRemove={(f) => setAsk(f)}
        />
      ) : null}

      {!ro ? (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label={B.fileInputLabel}
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (list.length) void addFiles(list);
            }}
            data-testid="bilan-input"
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-label={B.cameraInputLabel}
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (list.length) void addFiles(list);
            }}
          />
          <BilanDropOverlay enabled={!busy && !reviewOpen && !ask} onFiles={(fs) => void addFiles(fs)} />
        </>
      ) : null}

      {audiometry ? (
        <BilanReviewDialog
          open={reviewOpen}
          onOpenChange={(o) => {
            setReviewOpen(o);
            if (!o) flushSave();
          }}
          files={files}
          audiometry={audiometry}
          conflicts={conflicts}
          onChange={changeAudiometry}
          onResolveConflict={onResolveConflict}
          onSetCondition={(id, c) => {
            const f = files.find((x) => x.id === id);
            if (f) void setCondition(f, c);
          }}
          readOnly={ro}
          confirmed={confirmed}
          confirming={confirming}
          onConfirm={() => void confirm()}
          onCloseAutoFocus={(e) => {
            const target = afterConfirm.current;
            afterConfirm.current = false;
            if (target === false) return;
            e.preventDefault();
            revealSection(target);
          }}
        />
      ) : null}

      <AlertDialog open={ask !== null} onOpenChange={(o) => !o && setAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{B.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>{B.removeText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={() => {
                const f = ask;
                setAsk(null);
                if (f) void remove(f);
              }}
            >
              {B.removeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditorSection>
  );
}
