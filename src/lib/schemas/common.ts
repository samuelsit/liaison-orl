import { z } from "zod";

export const idSchema = z.string().min(1).max(64);

export const civilitySchema = z.enum(["Mme", "M."]);
export type Civility = z.infer<typeof civilitySchema>;

export const prescriberCivilitySchema = z.enum(["Dr", "Pr", "Mme", "M."]);
export type PrescriberCivility = z.infer<typeof prescriberCivilitySchema>;

/** Date calendaire au format AAAA-MM-JJ. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (format attendu : AAAA-MM-JJ)")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Date invalide");

export const optionalIsoDate = z.union([isoDateSchema, z.literal("")]).optional();

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB)");

export const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(254);
export const optionalEmail = z.union([emailSchema, z.literal("")]).optional();

export const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+().\s-]*$/, "Numéro de téléphone invalide");

export const postalAddressSchema = z.object({
  line1: z.string().trim().max(120).default(""),
  line2: z.string().trim().max(120).default(""),
  postalCode: z.string().trim().max(12).default(""),
  city: z.string().trim().max(80).default(""),
  country: z.string().trim().max(60).default("FRANCE"),
});
export type PostalAddress = z.infer<typeof postalAddressSchema>;

export function isAddressComplete(a: PostalAddress | null | undefined): boolean {
  return Boolean(a && a.line1 && a.postalCode && a.city && a.country);
}

export const roleSchema = z.enum(["admin", "audioprothesiste", "assistant"]);
export type Role = z.infer<typeof roleSchema>;

/** Données issues d'une image (data URL) : logo, signature. */
export const imageDataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Image invalide")
  .max(1_500_000, "Image trop lourde (1 Mo maximum)");
