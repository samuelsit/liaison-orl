import { z } from "zod";
import { hexColorSchema, idSchema, imageDataUrlSchema } from "./common";

export const FONT_CHOICES = ["Comfortaa", "Inter", "Nunito", "Montserrat", "Lato"] as const;
export const fontChoiceSchema = z.enum(FONT_CHOICES);
export type FontChoice = z.infer<typeof fontChoiceSchema>;

/** Palette complète des documents. Les teintes dérivées sont recalculables depuis primary/accent. */
export const brandColorsSchema = z.object({
  primary: hexColorSchema,
  accent: hexColorSchema,
  text: hexColorSchema,
  muted: hexColorSchema,
  surface: hexColorSchema,
  border: hexColorSchema,
  tint: hexColorSchema,
  footerLine: hexColorSchema,
});
export type BrandColors = z.infer<typeof brandColorsSchema>;

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(80),
  slogan: z.string().trim().max(80).default(""),
  logo: imageDataUrlSchema.nullable().default(null),
  colors: brandColorsSchema,
  fonts: z.object({
    heading: fontChoiceSchema,
    body: fontChoiceSchema,
    document: fontChoiceSchema,
  }),
});
export type Brand = z.infer<typeof brandSchema>;

export const deliveryProductSchema = z.enum(["cheap", "fast", "registered"]);
export type DeliveryProduct = z.infer<typeof deliveryProductSchema>;

export const organizationSettingsSchema = z.object({
  ai: z.object({
    enabled: z.boolean().default(true),
    tone: z.string().trim().max(400).default("confraternel, factuel, sobre et concis"),
    commentMinLines: z.number().int().min(2).max(10).default(4),
    commentMaxLines: z.number().int().min(3).max(12).default(8),
    /** Dictée vocale du navigateur (Chrome transmet l'audio aux serveurs de Google). */
    dictation: z.boolean().default(true),
  }),
  email: z.object({
    mode: z.enum(["secure-link", "attachment"]).default("secure-link"),
    secondFactor: z.enum(["birthdate", "code"]).default("birthdate"),
    linkValidityDays: z.number().int().min(1).max(90).default(30),
    copyToCentre: z.boolean().default(false),
    subjectTemplate: z.string().max(300),
    bodyTemplate: z.string().max(5000),
  }),
  postal: z.object({
    deliveryProduct: deliveryProductSchema.default("cheap"),
    printMode: z.enum(["simplex", "duplex"]).default("simplex"),
    printSpectrum: z.enum(["color", "grayscale"]).default("color"),
    addressPosition: z.enum(["left", "right"]).default("right"),
  }),
  retention: z.object({
    documentsMonths: z.number().int().min(1).max(600).default(60),
    auditMonths: z.number().int().min(6).max(600).default(36),
    outboxDays: z.number().int().min(1).max(365).default(30),
  }),
  permissions: z.object({
    assistantsCanSend: z.boolean().default(false),
    audioprosCanEditDirectory: z.boolean().default(true),
  }),
  documents: z.object({
    defaultSalutation: z.string().trim().max(60).default("Cher(e) Docteur"),
    salutations: z.array(z.string().trim().min(1).max(60)).max(30),
    showSignature: z.boolean().default(true),
    audiogramAnnex: z.boolean().default(true),
  }),
});
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export const legalSchema = z.object({
  companyName: z.string().trim().max(120).default(""),
  mentions: z.string().trim().max(1000).default(""),
});

export const organizationSchema = z.object({
  _id: idSchema,
  name: z.string().trim().min(1).max(120),
  brand: brandSchema,
  legal: legalSchema,
  settings: organizationSettingsSchema,
  /** Organisation créée par le seed de démonstration (données fictives). */
  demo: z.boolean().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Organization = z.infer<typeof organizationSchema>;
