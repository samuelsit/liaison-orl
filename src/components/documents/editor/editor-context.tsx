"use client";

import { createContext, useContext } from "react";
import type { DocumentData } from "@/lib/schemas/document";
import type { PatientView } from "@/server/services/patients";
import type { PrescriberView } from "@/server/services/prescribers";

export interface EditorShared {
  centres: { id: string; name: string }[];
  activeCentreId: string;
  salutations: string[];
  defaultSalutation: string;
  canEditDirectory: boolean;
  aiEnabled: boolean;
  dictationEnabled: boolean;
  aiMode: "live" | "mock";
}

export interface EditorContextValue<D extends DocumentData = DocumentData> {
  documentId: string;
  data: D;
  readOnly: boolean;
  errors: Record<string, string>;
  aiFields: string[];
  patient: PatientView | null;
  prescriber: PrescriberView | null;
  shared: EditorShared;
  /** Modification par l'utilisateur : retire le badge IA du champ. */
  update: (patch: Partial<D>) => void;
  /** Suggestion de l'IA : marque les champs comme « suggérés ». */
  suggest: (patch: Partial<D>, fields: string[]) => void;
  acceptAi: (field: string) => void;
  setPatient: (p: PatientView | null, prescriber?: PrescriberView | null) => void;
  setPrescriber: (p: PrescriberView | null) => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor<D extends DocumentData>(): EditorContextValue<D> {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor hors de l'éditeur");
  return ctx as unknown as EditorContextValue<D>;
}
