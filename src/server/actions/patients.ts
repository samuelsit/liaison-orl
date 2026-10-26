"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContextOrThrow } from "@/lib/auth/session";
import { createPatient, deletePatient, listPatients, updatePatient, type PatientView } from "@/server/services/patients";
import { runAction, type ActionResult } from "./result";

export async function searchPatientsAction(query: string, scope: "active" | "all" = "active"): Promise<PatientView[]> {
  const ctx = await getUserContextOrThrow();
  const res = await listPatients(ctx, { q: String(query).slice(0, 80), scope, limit: 10 });
  return res.items;
}

export async function createPatientAction(
  input: unknown,
  force = false,
): Promise<ActionResult<{ created: PatientView | null; similar: PatientView[] }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await createPatient(ctx, input, { force });
    if (res.created) revalidatePath("/patients");
    return res;
  });
}

export async function updatePatientAction(id: string, input: unknown): Promise<ActionResult<PatientView>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await updatePatient(ctx, z.string().parse(id), input);
    revalidatePath("/patients");
    revalidatePath(`/patients/${id}`);
    return res;
  }, "Patient enregistré.");
}

export async function deletePatientAction(id: string): Promise<ActionResult<{ documents: number }>> {
  return runAction(async () => {
    const ctx = await getUserContextOrThrow();
    const res = await deletePatient(ctx, z.string().parse(id));
    revalidatePath("/patients");
    return { documents: res.documents };
  });
}
