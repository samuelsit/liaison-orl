"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { CSV_TEMPLATE_HEADERS, parsePrescriberRows, type CsvRowResult } from "@/lib/prescribers/csv";
import { importPrescribersAction } from "@/server/actions/prescribers";
import type { ImportReport } from "@/server/services/prescribers";
import { dirFr } from "@/lib/i18n/directory";
import { fr } from "@/lib/i18n/fr";

const T = dirFr.csv;

export function CsvImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<CsvRowResult[]>([]);
  const [fileName, setFileName] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  function reset() {
    setRows([]);
    setResults([]);
    setFileName("");
    setReport(null);
  }

  function onFile(file: File) {
    setReport(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (res) => {
        const data = res.data.slice(0, 5000);
        setRows(data);
        setResults(parsePrescriberRows(data));
      },
      error: () => toast.error("Impossible de lire ce fichier. Vérifiez qu'il s'agit d'un CSV."),
    });
  }

  function downloadTemplate() {
    const example = ["Dr", "Martin", "Anne", "ORL", "", "Cabinet ORL du Centre", "12 rue de la Paix", "", "75002", "Paris", "FRANCE", "a.martin@exemple.test", "01 99 00 00 00", "email", "Chère Consœur", ""];
    const csv = `﻿${CSV_TEMPLATE_HEADERS.join(";")}\n${example.join(";")}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-annuaire-prescripteurs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function run() {
    setPending(true);
    const res = await importPrescribersAction({ rows, updateExisting });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    setReport(res.data);
    toast.success(T.done(res.data.created, res.data.updated, res.data.skipped));
    onDone();
  }

  const valid = results.filter((r) => r.ok).length;
  const invalid = results.length - valid;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{T.title}</DialogTitle>
          <DialogDescription>{T.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download aria-hidden /> {T.template}
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 focus-within:outline-2 pointer-coarse:min-h-11">
              <FileUp className="size-4" aria-hidden />
              {T.choose}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </div>
          {fileName ? (
            <p className="text-sm">
              <span className="font-medium">{fileName}</span> — {T.preview(valid, invalid)}
            </p>
          ) : null}
          {invalid > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="max-h-32 list-disc overflow-auto pl-4 text-sm">
                  {results
                    .filter((r) => !r.ok)
                    .slice(0, 20)
                    .map((r) => (
                      <li key={r.row}>
                        Ligne {r.row} : {r.error}
                      </li>
                    ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(v === true)} className="mt-0.5" />
            {T.updateExisting}
          </label>
          {report ? (
            <Alert>
              <AlertDescription>{T.done(report.created, report.updated, report.skipped)}</AlertDescription>
            </Alert>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.close}
          </Button>
          <Button onClick={run} disabled={valid === 0 || pending || Boolean(report)}>
            {pending ? <Spinner /> : null}
            {T.run} {valid > 0 ? `(${valid})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
