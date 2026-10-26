"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, MoreHorizontal, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteAttachmentAction, extractBilanAction, saveExtractionAction } from "@/server/actions/ai";
import { emptyAudiometry, type Audiometry } from "@/lib/schemas/audiometry";
import type { CompteRenduData } from "@/lib/schemas/document";
import { countMeasures } from "@/lib/audiology/calculations";
import { docFr } from "@/lib/i18n/documents";
import { fr } from "@/lib/i18n/fr";
import { crFr } from "@/lib/i18n/compte-rendu";
import { useEditor } from "./editor-context";
import { EditorSection } from "./section";
import { useCompteRenduUi } from "./bilan/cr-context";
import { BilanDropOverlay, BilanDropzone, BilanProgress, type UploadStep } from "./bilan/bilan-upload";
import { BilanReviewDialog } from "./bilan/bilan-review-dialog";
import { BilanSummary } from "./bilan/bilan-summary";

const B = crFr.bilan;

export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  extractionStatus: "pending" | "done" | "failed" | "manual";
  extractionError?: string | null;
  confirmed: boolean;
  createdAt: string;
  extraction?: Audiometry | null;
}

const MAX_BYTES = 4 * 1024 * 1024;

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

export function BilanPanel({ attachments }: { attachments: AttachmentView[] }) {
  const ed = useEditor<CompteRenduData>();
  const cr = useCompteRenduUi();
  const initial = attachments.find((a) => a.id === ed.data.attachmentId) ?? attachments[0] ?? null;
  const [att, setAtt] = useState<AttachmentView | null>(initial);
  const [audiometry, setAudiometry] = useState<Audiometry | null>(initial ? (initial.extraction ?? emptyAudiometry()) : null);
  const [confirmed, setConfirmed] = useState(Boolean(initial?.confirmed));
  const [step, setStep] = useState<UploadStep | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(initial?.extractionStatus === "failed" ? (initial.extractionError ?? B.readFailedTitle) : null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ask, setAsk] = useState<null | { kind: "remove" } | { kind: "replace"; file: File | null }>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<Audiometry | null>(null);
  const afterConfirm = useRef<Element | null | false>(false);
  const ro = ed.readOnly;
  const busy = step !== null;
  const { setBilan, setOpenReview } = cr;

  // Publie l'état du bilan pour le reste du formulaire (degré conseillé, état des sections, commentaire).
  useEffect(() => {
    setBilan({ attachmentId: att?.id ?? null, audiometry, confirmed });
  }, [att?.id, audiometry, confirmed, setBilan]);

  useEffect(() => {
    setOpenReview(att && audiometry ? () => setReviewOpen(true) : null);
    return () => setOpenReview(null);
  }, [att, audiometry, setOpenReview]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const a = pendingSave.current;
    pendingSave.current = null;
    if (a && att) void saveExtractionAction(att.id, a, confirmed);
  }, [att, confirmed]);

  // Enregistre une correction en attente si l'éditeur est quitté.
  const flushRef = useRef(flushSave);
  useEffect(() => {
    flushRef.current = flushSave;
  });
  useEffect(() => () => flushRef.current(), []);

  const upload = useCallback(
    async (raw: File) => {
      if (ro) return;
      if (raw.type && !raw.type.startsWith("image/") && raw.type !== "application/pdf") {
        if (att) return void toast.error(B.unsupported);
        return setError(B.unsupported);
      }
      setError(null);
      const file = await compressImage(raw);
      if (file.size > MAX_BYTES) {
        if (att) return void toast.error(B.tooLarge);
        return setError(B.tooLarge);
      }
      // Ouverture automatique de la vérification, sauf si l'utilisateur a continué à saisir entre-temps.
      let interacted = false;
      const onInput = (e: Event) => {
        if (!(e.target instanceof HTMLInputElement && e.target.type === "file")) interacted = true;
      };
      document.addEventListener("input", onInput, true);
      setUploadFile(file);
      setStep("uploading");
      try {
        const form = new FormData();
        form.append("fichier", file);
        const res = await fetch(`/api/documents/${ed.documentId}/bilan`, { method: "POST", body: form });
        const json = (await res.json().catch(() => ({}))) as AttachmentView & { error?: string };
        if (!res.ok) {
          setStep(null);
          if (att) return void toast.error(json.error ?? B.uploadFailed);
          return setError(json.error ?? B.uploadFailed);
        }
        pendingSave.current = null;
        setAtt(json);
        setConfirmed(false);
        setFailed(null);
        setStep("reading");
        const t = setTimeout(() => setStep((s) => (s === "reading" ? "extracting" : s)), 1400);
        const ex = await extractBilanAction(json.id);
        clearTimeout(t);
        setStep(null);
        if (!ex.ok) {
          setFailed(ex.error);
          setAudiometry(emptyAudiometry());
          return;
        }
        setAudiometry(ex.data);
        if (!interacted) setReviewOpen(true);
        else toast.success(B.extracted(countMeasures(ex.data)), { action: { label: B.reviewAction, onClick: () => setReviewOpen(true) } });
      } finally {
        document.removeEventListener("input", onInput, true);
        setUploadFile(null);
      }
    },
    [att, ed.documentId, ro],
  );

  /** Nouveau fichier : confirmation si des mesures existent déjà. */
  const offer = useCallback(
    (file: File | null) => {
      if (att && audiometry && countMeasures(audiometry) > 0) return setAsk({ kind: "replace", file });
      if (file) void upload(file);
      else fileInput.current?.click();
    },
    [att, audiometry, upload],
  );

  // Coller une capture d'écran (Ctrl/⌘ + V) hors d'un champ de saisie.
  useEffect(() => {
    if (ro || busy || reviewOpen) return;
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/") || f.type === "application/pdf");
      if (file && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        offer(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, offer, reviewOpen, ro]);

  function changeAudiometry(a: Audiometry) {
    setAudiometry(a);
    if (!att || ro) return;
    pendingSave.current = a;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 1000);
  }

  async function confirm() {
    if (!att || !audiometry || confirming) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    setConfirming(true);
    const res = await saveExtractionAction(att.id, audiometry, true);
    setConfirming(false);
    if (!res.ok) return void toast.error(res.error);
    const again = confirmed;
    setAtt(res.data.attachment);
    setConfirmed(true);
    setFailed(null);
    ed.update({ attachmentId: att.id });
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
      if (fields.length) ed.suggest({ ...patch, attachmentId: att.id }, fields);
    }
    toast.success(again ? B.correctionsSaved : B.confirmed);
    afterConfirm.current = fields.length ? document.getElementById("sec-patient") : nextIncompleteSection();
    setReviewOpen(false);
    if (!ed.data.comments.trim() && ed.shared.aiEnabled) {
      void cr.comment.run("standard", {
        data: { attachmentId: att.id, degree: patch.degree ?? ed.data.degree, ears: patch.ears ?? ed.data.ears },
        auto: true,
      });
    }
  }

  async function remove() {
    if (!att) return;
    const res = await deleteAttachmentAction(att.id);
    if (!res.ok) return void toast.error(res.error);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    setAtt(null);
    setAudiometry(null);
    setConfirmed(false);
    setFailed(null);
    setError(null);
    ed.update({ attachmentId: null });
    toast.success(B.removed);
  }

  const menu =
    att && !busy ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={B.moreActions}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuItem asChild>
            <a href={`/api/pieces-jointes/${att.id}`} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> {B.openOriginal}
            </a>
          </DropdownMenuItem>
          {!ro ? (
            <>
              <DropdownMenuItem onSelect={() => offer(null)}>
                <RotateCcw aria-hidden /> {B.replace}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setAsk({ kind: "remove" })}>
                <Trash2 aria-hidden /> {B.remove}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <EditorSection
      title={docFr.sections.bilan}
      id="sec-bilan"
      step={2}
      status={confirmed ? "complete" : "incomplete"}
      description={!att && !ro ? crFr.sections.bilanDescription : undefined}
      aside={menu}
    >
      {error && !busy ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {busy ? <BilanProgress file={uploadFile} step={step} /> : null}

      {!att && !busy ? (
        ro ? (
          <p className="text-meta text-muted-foreground">{B.noBilan}</p>
        ) : (
          <BilanDropzone onChoose={() => fileInput.current?.click()} onCamera={() => cameraInput.current?.click()} />
        )
      ) : null}

      {att && audiometry && !busy ? (
        <BilanSummary
          attachment={att}
          audiometry={audiometry}
          confirmed={confirmed}
          readOnly={ro}
          failedMessage={failed}
          commentPending={cr.comment.pending !== null && !ro}
          onOpenReview={() => setReviewOpen(true)}
          onChooseOther={() => fileInput.current?.click()}
          onRetakePhoto={() => cameraInput.current?.click()}
        />
      ) : null}

      {!ro ? (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            tabIndex={-1}
            aria-label={B.fileInputLabel}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
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
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          <BilanDropOverlay enabled={!busy && !reviewOpen && !ask} onFile={(f) => offer(f)} />
        </>
      ) : null}

      {audiometry ? (
        <BilanReviewDialog
          open={reviewOpen}
          onOpenChange={(o) => {
            setReviewOpen(o);
            if (!o) flushSave();
          }}
          attachment={att}
          audiometry={audiometry}
          onChange={changeAudiometry}
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
            <AlertDialogTitle>{ask?.kind === "remove" ? B.removeTitle : B.replaceTitle}</AlertDialogTitle>
            <AlertDialogDescription>{ask?.kind === "remove" ? B.removeText : B.replaceText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            {ask?.kind === "remove" ? (
              <AlertDialogAction variant="destructive-solid" onClick={() => void remove()}>
                {B.removeConfirm}
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={() => {
                  const file = ask?.kind === "replace" ? ask.file : null;
                  if (file) void upload(file);
                  else fileInput.current?.click();
                }}
              >
                {ask?.kind === "replace" && ask.file ? B.replaceConfirm : B.replaceChoose}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditorSection>
  );
}
