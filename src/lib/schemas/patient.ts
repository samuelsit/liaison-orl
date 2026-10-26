import { z } from "zod";
import { civilitySchema, idSchema, isoDateSchema } from "./common";

export const patientInputSchema = z.object({
  civility: civilitySchema,
  lastName: z.string().trim().min(1, "Nom obligatoire").max(80),
  firstName: z.string().trim().min(1, "Prénom obligatoire").max(80),
  birthDate: z.union([isoDateSchema, z.literal("")]).default(""),
  centreId: idSchema,
  usualPrescriberId: idSchema.nullable().default(null),
});
export type PatientInput = z.infer<typeof patientInputSchema>;

export const patientSchema = patientInputSchema.extend({
  _id: idSchema,
  organizationId: idSchema,
  searchText: z.string(),
  createdBy: idSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Patient = z.infer<typeof patientSchema>;
