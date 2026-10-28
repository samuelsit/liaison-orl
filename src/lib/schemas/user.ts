import { z } from "zod";
import { emailSchema, idSchema, imageDataUrlSchema, roleSchema } from "./common";

/** Valeurs mémorisées : compteur d'usage par champ et par valeur. */
export const learnedDefaultsSchema = z.record(z.string(), z.record(z.string(), z.number().int().nonnegative()));
export type LearnedDefaults = z.infer<typeof learnedDefaultsSchema>;

export const userPreferencesSchema = z.object({
  activeCentreId: idSchema.nullable().default(null),
  learned: learnedDefaultsSchema.default({}),
  favoritesFirst: z.boolean().default(true),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const userInviteSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().min(1, "Prénom obligatoire").max(60),
  lastName: z.string().trim().min(1, "Nom obligatoire").max(60),
  title: z.string().trim().max(80).default("Audioprothésiste D.E"),
  role: roleSchema,
  /** Ignoré pour un administrateur, rattaché d'office à tous les centres. */
  centreIds: z.array(idSchema).default([]),
  canSend: z.boolean().default(false),
}).refine((u) => u.role === "admin" || u.centreIds.length > 0, { message: "Rattachez au moins un centre", path: ["centreIds"] });
export type UserInvite = z.infer<typeof userInviteSchema>;

/** Numéro RPPS : 11 chiffres (facultatif). */
export const rppsSchema = z.union([z.string().trim().regex(/^\d{11}$/, "Le numéro RPPS comporte 11 chiffres"), z.literal("")]);

export const userProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  title: z.string().trim().max(80),
  rpps: rppsSchema.default(""),
});

/** Utilisateur tel que stocké (collection « user » gérée par Better Auth + champs métier). */
export interface AppUserDoc {
  _id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  role: z.infer<typeof roleSchema>;
  organizationId: string;
  centreIds: string[];
  firstName: string;
  lastName: string;
  title: string;
  /** Numéro RPPS imprimé sous la signature (facultatif). */
  rpps?: string;
  active: boolean;
  canSend: boolean;
  twoFactorEnabled?: boolean;
  /** Dispense de la double authentification obligatoire des administrateurs, accordée par un autre administrateur. */
  twoFactorExempt?: boolean;
  signature?: z.infer<typeof imageDataUrlSchema> | null;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}
