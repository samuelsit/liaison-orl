import { z } from "zod";
import { emailSchema, idSchema, phoneSchema, postalAddressSchema } from "./common";

export const centreInputSchema = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(80),
  address: postalAddressSchema,
  phone: phoneSchema.default(""),
  email: z.union([emailSchema, z.literal("")]).default(""),
  defaultSignature: z.string().trim().max(500).default(""),
  /** Adresse d'expéditeur imprimée sur les courriers postaux (vide = adresse du centre). */
  senderAddress: postalAddressSchema.nullable().default(null),
  active: z.boolean().default(true),
});
export type CentreInput = z.infer<typeof centreInputSchema>;

export const centreSchema = centreInputSchema.extend({
  _id: idSchema,
  organizationId: idSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Centre = z.infer<typeof centreSchema>;
