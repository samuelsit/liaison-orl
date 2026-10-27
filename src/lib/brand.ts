import { DOCUMENT_FONT_CHOICES, type Brand, type BrandColors, type DocumentFontChoice, type FontChoice, type OrganizationSettings } from "@/lib/schemas/organization";

/**
 * Thème par défaut (cahier des charges §2.2). Ce ne sont que des valeurs
 * initiales : la marque réelle est toujours lue dans la configuration.
 */
export const DEFAULT_COLORS: BrandColors = {
  primary: "#1F3F7A",
  accent: "#E8632B",
  text: "#1A1F2B",
  muted: "#9AA4B2",
  surface: "#F4F6FA",
  border: "#4A6FAA",
  tint: "#E6EEF8",
  footerLine: "#88A8D2",
};

export const DEFAULT_FONTS: Brand["fonts"] = { heading: "Comfortaa", body: "Inter", document: "Inter" };

/**
 * Police réellement utilisée dans les documents envoyés : Comfortaa (police de titre
 * de l'interface) n'est pas assez lisible en corps de texte, elle est remplacée par Inter.
 */
export function documentFont(font: FontChoice): DocumentFontChoice {
  return (DOCUMENT_FONT_CHOICES as readonly string[]).includes(font) ? (font as DocumentFontChoice) : "Inter";
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Mélange deux couleurs : ratio = part de `b`. */
export function mix(a: string, b: string, ratio: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => ca[i]! * (1 - ratio) + cb[i]! * ratio) as [number, number, number]);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Teintes dérivées recalculées à partir des couleurs principale et d'accent. */
export function derivePalette(primary: string, accent: string): BrandColors {
  return {
    primary,
    accent,
    text: mix(primary, "#2E2E2E", 0.86),
    muted: mix(primary, "#FFFFFF", 0.55),
    surface: mix(primary, "#FFFFFF", 0.955),
    border: mix(primary, "#FFFFFF", 0.22),
    tint: mix(primary, "#FFFFFF", 0.9),
    footerLine: mix(primary, "#FFFFFF", 0.5),
  };
}

/** Surfaces de l'interface utilisées comme références de contraste (cf. globals.css). */
export const UI_SURFACES = {
  /** Fond le plus foncé sur lequel du texte de marque apparaît en mode clair (--muted). */
  lightMuted: "#F1F3F6",
  /** Fond de l'application en mode sombre (--background). */
  darkBackground: "#0D1117",
  /** Surface sombre la plus claire (--popover) : pire cas pour le texte de marque. */
  darkPopover: "#1A212C",
  /** Encre utilisée sur les aplats clairs. */
  ink: "#0D1117",
} as const;

/** Teinte claire de la marque (fonds sélectionnés, --brand-tint). */
export function brandTint(primary: string): string {
  return mix(primary, "#FFFFFF", 0.9);
}

/**
 * Texte de couleur de marque en mode clair (liens, icônes actives) : la couleur
 * principale, assombrie seulement si elle n'atteint pas 4,5:1 sur les fonds clairs.
 */
export function primaryForLight(primary: string): string {
  const tint = brandTint(primary);
  const ok = (c: string) => contrastRatio(c, UI_SURFACES.lightMuted) >= 4.5 && contrastRatio(c, tint) >= 4.5;
  let c = primary;
  for (let i = 0; i < 20 && !ok(c); i++) c = mix(c, "#000000", 0.08);
  return c;
}

/**
 * Texte de couleur de marque en mode sombre : éclairci jusqu'à 4,5:1 sur la
 * surface sombre la plus claire (popover), donc lisible partout.
 */
export function primaryForDark(primary: string): string {
  let c = primary;
  for (let i = 0; i < 20 && contrastRatio(c, UI_SURFACES.darkPopover) < 4.5; i++) c = mix(c, "#FFFFFF", 0.1);
  return c;
}

/**
 * Aplat de marque en mode sombre (boutons principaux) : éclairci par pas de 5 %
 * jusqu'à se détacher du fond (3:1), sans que le texte blanc ne passe sous 4,5:1.
 */
export function primaryFillForDark(primary: string): string {
  let c = primary;
  for (let i = 0; i < 20 && contrastRatio(c, UI_SURFACES.darkBackground) < 3; i++) {
    const next = mix(c, "#FFFFFF", 0.05);
    if (contrastRatio("#FFFFFF", next) < 4.5) break;
    c = next;
  }
  return c;
}

/** Couleur du texte posé sur un aplat : blanc s'il atteint 4,5:1, sinon le plus contrasté (encre en général). */
export function onColor(fill: string): string {
  const white = contrastRatio("#FFFFFF", fill);
  if (white >= 4.5) return "#FFFFFF";
  return contrastRatio(UI_SURFACES.ink, fill) > white ? UI_SURFACES.ink : "#FFFFFF";
}

/** Variables CSS de l'interface dérivées de la couleur principale (injectées par BrandStyle). */
export function brandCssVariables(primary: string, accent: string): Record<string, string> {
  const fillDark = primaryFillForDark(primary);
  return {
    "--brand-primary": primary,
    "--brand-primary-text": primaryForLight(primary),
    "--brand-primary-dark": primaryForDark(primary),
    "--brand-primary-fill-dark": fillDark,
    "--brand-on-primary": onColor(primary),
    "--brand-on-primary-dark": onColor(fillDark),
    "--brand-accent": accent,
    "--brand-tint": brandTint(primary),
  };
}

/** Couleur d'accent utilisable pour du texte sur fond blanc (WCAG AA). */
export function accentForText(accent: string): string {
  let c = accent;
  for (let i = 0; i < 12 && contrastRatio(c, "#FFFFFF") < 4.5; i++) c = mix(c, "#000000", 0.08);
  return c;
}

/** Mentions légales des pieds de page (documents, e-mails) : raison sociale puis mentions, sur une ligne. */
export function legalLine(legal: { companyName: string; mentions: string }): string {
  return [legal.companyName, legal.mentions.replace(/\s*\n+\s*/g, " · ")]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

/** Nom complet d'un centre : « Marque — Ville ». */
export function centreDisplayName(brandName: string, centreName: string): string {
  return centreName ? `${brandName} — ${centreName}` : brandName;
}

export const DEFAULT_SALUTATIONS = [
  "Cher(e) Docteur",
  "Cher Docteur",
  "Chère Docteure",
  "Cher Confrère",
  "Chère Consœur",
  "Cher Professeur",
  "Chère Professeure",
  "Chère Madame",
  "Cher Monsieur",
  "Madame",
  "Monsieur",
];

export const DEFAULT_EMAIL_SUBJECT = "{{document.type}} — {{patient.civilite}} {{patient.nom_abrege}}";

export const DEFAULT_EMAIL_BODY = `{{prescripteur.formule}},

Je vous adresse le {{document.type_minuscule}} concernant {{patient.civilite}} {{patient.nom_abrege}}.

{{acces}}

Je reste à votre disposition pour tout complément d'information.

Bien confraternellement,

{{audioprothesiste.nom}}
{{audioprothesiste.titre}}
{{centre.nom}} — {{centre.telephone}}`;

export function defaultSettings(): OrganizationSettings {
  return {
    ai: { enabled: true, tone: "confraternel, factuel, sobre et concis", commentMinLines: 4, commentMaxLines: 8, dictation: true },
    email: {
      mode: "secure-link",
      secondFactor: "birthdate",
      linkValidityDays: 30,
      copyToCentre: false,
      subjectTemplate: DEFAULT_EMAIL_SUBJECT,
      bodyTemplate: DEFAULT_EMAIL_BODY,
    },
    postal: { deliveryProduct: "cheap", printMode: "simplex", printSpectrum: "color", addressPosition: "right" },
    retention: { documentsMonths: 60, auditMonths: 36, outboxDays: 30 },
    permissions: { assistantsCanSend: false, audioprosCanEditDirectory: true },
    documents: {
      defaultSalutation: "Cher(e) Docteur",
      salutations: DEFAULT_SALUTATIONS,
      showSignature: true,
      audiogramAnnex: true,
    },
  };
}
