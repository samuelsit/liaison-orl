import "server-only";
import { Text } from "@react-pdf/renderer";
import { pdfFr } from "@/lib/i18n/pdf";
import { BulletList } from "../components/blocks";
import { bodyStyle } from "../components/theme";
import { typo } from "../typography";
import type { PdfModel, PdfRenderOptions } from "../model";
import { LetterPage, longDate, personLabel } from "./letter";

type AdressageModel = Extract<PdfModel, { type: "ADRESSAGE" }>;

/** Examens demandés : seulement ceux retenus, le motif « Autre » rédigé en phrase. */
export function adressageExams(model: AdressageModel): string[] {
  const { exams, autreText } = model.data;
  const items: string[] = [];
  if (exams.conduits) items.push(pdfFr.adressage.conduits);
  if (exams.bilan) items.push(pdfFr.adressage.bilan);
  const autre = autreText.trim().replace(/\s+/g, " ");
  if (exams.autre && autre)
    items.push(
      typo(/[.!?…]$/.test(autre) ? autre : `${autre}.`).replace(/^\p{Ll}/u, (c) => c.toLocaleUpperCase("fr-FR")),
    );
  return items;
}

/**
 * Courrier d'adressage : une page courte et confraternelle, imprimée ou téléchargée
 * (jamais envoyée par courrier : toujours la version standard, sans bloc adresse postal).
 */
export function AdressagePage({ model, options }: { model: AdressageModel; options: PdfRenderOptions }) {
  const exams = adressageExams(model);
  const p = model.patient;
  return (
    <LetterPage model={model} variant="standard" options={options}>
      {(theme) => ({
        body: (
          <>
            <Text style={bodyStyle(theme)}>
              {pdfFr.adressage.intro(
                personLabel(p),
                p?.civility ?? "",
                p?.birthDate ? longDate(p.birthDate) : "",
                exams.length,
              )}
            </Text>
            {exams.length ? <BulletList theme={theme} items={exams} /> : null}
          </>
        ),
      })}
    </LetterPage>
  );
}
