import { z } from "zod";
import { idSchema, optionalEmail, phoneSchema, postalAddressSchema, prescriberCivilitySchema } from "./common";

export const preferredChannelSchema = z.enum(["email", "courrier", "both"]);
export type PreferredChannel = z.infer<typeof preferredChannelSchema>;

export const SPECIALTIES = ["ORL", "Médecin généraliste", "Gériatre", "Neurologue", "Pédiatre", "Autre"] as const;

export const prescriberInputSchema = z.object({
  civility: prescriberCivilitySchema.default("Dr"),
  lastName: z.string().trim().min(1, "Nom obligatoire").max(80),
  firstName: z.string().trim().max(80).default(""),
  specialty: z.string().trim().max(80).default("ORL"),
  rpps: z
    .string()
    .trim()
    .regex(/^(\d{11})?$/, "Le n° RPPS comporte 11 chiffres")
    .default(""),
  practiceName: z.string().trim().max(120).default(""),
  address: postalAddressSchema,
  email: optionalEmail.default(""),
  phone: phoneSchema.default(""),
  preferredChannel: preferredChannelSchema.default("email"),
  salutation: z.string().trim().max(60).default(""),
  notes: z.string().trim().max(2000).default(""),
  centreIds: z.array(idSchema).default([]),
});
export type PrescriberInput = z.infer<typeof prescriberInputSchema>;

export const prescriberSchema = prescriberInputSchema.extend({
  _id: idSchema,
  organizationId: idSchema,
  favoriteOf: z.array(idSchema).default([]),
  archived: z.boolean().default(false),
  searchText: z.string(),
  createdBy: idSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Prescriber = z.infer<typeof prescriberSchema>;
