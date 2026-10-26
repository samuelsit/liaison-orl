import { env } from "@/lib/env";
import { emptyAudiometry, type Curve } from "@/lib/schemas/audiometry";
import { fromAudiometry, type RawExtraction } from "./extraction-schema";
import type { AiFile, AiProvider, AiResult, AiUsage, CommentFacts, CommentRequest } from "./types";

/** Marqueur intégré aux bilans fictifs générés par le seed (vérité terrain pour le mode démo). */
export const DEMO_MARKER = "LORL-DEMO:";

const usage = (model: string, input: number, output: number): AiUsage => ({
  model,
  mock: true,
  inputTokens: input,
  outputTokens: output,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, process.env.NODE_ENV === "test" || process.env.LORL_MOCK_FAST === "1" ? 0 : ms));

/** Lit la vérité terrain d'un bilan de démonstration, si présente. */
export function readDemoMarker(data: Buffer): RawExtraction | null {
  const text = data.toString("latin1");
  const idx = text.indexOf(DEMO_MARKER);
  if (idx < 0) return null;
  const m = /^[A-Za-z0-9+/=]+/.exec(text.slice(idx + DEMO_MARKER.length));
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[0], "base64").toString("utf8")) as RawExtraction;
  } catch {
    return null;
  }
}

function curve(values: Record<string, number>, low: string[] = []): Curve {
  return Object.fromEntries(
    Object.entries(values).map(([f, v]) => [f, { value: v, confidence: low.includes(f) ? ("low" as const) : f === "750" ? ("medium" as const) : ("high" as const) }]),
  );
}

/** Audiogramme plausible (presbyacousie bilatérale) quand le fichier n'est pas un bilan de démonstration. */
function genericExtraction(seed: number): RawExtraction {
  const s = (seed % 3) * 5;
  const a = emptyAudiometry();
  a.right.air = curve({ "250": 20 + s, "500": 30 + s, "1000": 40 + s, "2000": 50 + s, "4000": 65 + s, "8000": 75 + s }, ["8000"]);
  a.left.air = curve({ "250": 15 + s, "500": 25 + s, "1000": 35 + s, "2000": 50 + s, "4000": 60 + s, "8000": 70 + s });
  a.right.bone = curve({ "500": 25 + s, "1000": 35 + s, "2000": 45 + s, "4000": 60 + s });
  a.left.bone = curve({ "500": 20 + s, "1000": 30 + s, "2000": 45 + s, "4000": 55 + s }, ["4000"]);
  a.freeField.unaided = curve({ "500": 35 + s, "1000": 40 + s, "2000": 50 + s, "4000": 60 + s });
  a.freeField.aided = curve({ "500": 25, "1000": 25, "2000": 30, "4000": 40 }, ["4000"]);
  a.freeField.speechUnaided = { srt: { value: 50 + s, confidence: "medium" }, maxScore: { value: 70, confidence: "high" }, maxScoreLevel: { value: 70, confidence: "high" } };
  a.freeField.speechAided = { srt: { value: 35, confidence: "medium" }, maxScore: { value: 90, confidence: "high" }, maxScoreLevel: { value: 60, confidence: "high" } };
  a.notes = "Valeurs simulées (mode démo sans clé d'API) : vérifiez-les avant de confirmer.";
  return fromAudiometry(a);
}

const n = (v: number | null) => (v === null ? null : Math.round(v).toLocaleString("fr-FR"));

/** Rédaction déterministe et réaliste à partir des faits calculés. */
export function mockComment(f: CommentFacts, style: CommentRequest["style"]): string {
  const p = f.civility === "Mme" ? "la patiente" : "le patient";
  const s: string[] = [];
  const stereo = f.ears === "les deux" ? "stéréophonique" : f.ears ? `de l'oreille ${f.ears}` : "";
  const device = [f.deviceType ? f.deviceType.toLowerCase() : null, f.rechargeable ? "rechargeable" : null].filter(Boolean).join(" ");
  s.push(`Appareillage ${stereo}${device ? ` en ${device}` : ""}${f.brand ? ` (${f.brand}${f.model ? ` ${f.model}` : ""})` : ""}, ${f.motivation === "Peu motivé(e)" ? "accepté avec quelques réticences" : "bien accepté"}.`.replace(/\s+/g, " ").replace(" ,", ","));
  if (f.meanGain !== null) {
    const tech = style === "technique" && f.ptaRight !== null && f.ptaLeft !== null ? ` pour une perte moyenne de ${n(f.ptaRight)} dB à droite et ${n(f.ptaLeft)} dB à gauche` : "";
    s.push(`Le gain tonal moyen mesuré en champ libre est de ${n(f.meanGain)} dB${tech}.`);
  }
  const speech: string[] = [];
  if (f.srtGain !== null) speech.push(`un seuil d'intelligibilité amélioré de ${n(f.srtGain)} dB${style === "technique" && f.srtUnaided !== null && f.srtAided !== null ? ` (${n(f.srtUnaided)} → ${n(f.srtAided)} dB)` : ""}`);
  if (f.scoreGain !== null) speech.push(`un gain de ${n(f.scoreGain)} points en intelligibilité maximale${f.scoreAided !== null ? ` (${n(f.scoreAided)} % appareillé)` : ""}`);
  if (speech.length) s.push(`En audiométrie vocale, on note ${speech.join(" et ")}.`);
  if (f.noiseSnrGain !== null || f.noiseScoreGain !== null) {
    s.push(`Dans le bruit${f.noiseTest ? ` (${f.noiseTest})` : ""}, le bénéfice est ${f.noiseSnrGain !== null && f.noiseSnrGain >= 3 ? "net" : "plus modeste"}.`);
  }
  if (style !== "court") {
    const obs: string[] = [];
    if (f.hoursPerDay !== null) obs.push(`un port quotidien de ${n(f.hoursPerDay)} h`);
    if (f.wearDuration) obs.push(`depuis ${f.wearDuration}`);
    if (obs.length) s.push(`Observance satisfaisante avec ${obs.join(" ")}.`);
    if (f.handling === "Oui") s.push("La manipulation est acquise.");
    else if (f.handling === "À travailler") s.push(`La manipulation reste à consolider avec ${p}.`);
    else if (f.handling === "Non") s.push(`La manipulation n'est pas encore acquise ; un accompagnement de l'entourage est souhaitable.`);
  }
  if (style === "detaille") s.push("La compréhension dans les environnements bruyants reste le principal point de vigilance ; les réglages seront affinés selon les retours.");
  if (f.userNotes.trim()) s.push(f.userNotes.trim().replace(/\s+/g, " "));
  s.push(style === "court" ? "Contrôle prévu à un mois." : "Un contrôle est prévu à un mois, puis un suivi tous les six mois.");
  return s.join(" ");
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bOD\b/g, "à l'oreille droite"],
  [/\bOG\b/g, "à l'oreille gauche"],
  [/\bCAE\b/g, "du conduit auditif externe"],
  [/\bsem(aines?)?\b/gi, "semaines"],
];

/** Reformulation simple et prudente des notes (mode démo). */
export function mockMotif(notes: string): string {
  let t = notes.trim().replace(/\s+/g, " ");
  for (const [re, rep] of ABBREVIATIONS) t = t.replace(re, rep);
  const parts = t.split(/[,;.]+/).map((s) => s.trim()).filter(Boolean);
  const sentences = parts.map((p) => {
    let s = p;
    if (/c[ée]rumen|bouchon/i.test(s) && !/suspicion/i.test(s)) s = `suspicion de ${s.replace(/^(probable|possible)\s+/i, "").replace(/\s+(probable|possible)\b/i, "")}`;
    if (/vertige/i.test(s) && /depuis/i.test(s)) s = s.replace(/vertiges?/i, "vertiges évoluant");
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
  return `${sentences.join(". ")}. Merci de votre avis.`.replace(/\.\./g, ".");
}

export function mockDictation(text: string): string {
  let t = text
    .replace(/\s*\b(virgule)\b\s*/gi, ", ")
    .replace(/\s*\b(point final|point)\b\s*/gi, ". ")
    .replace(/\s*\bà la ligne\b\s*/gi, "\n")
    .replace(/\b(euh+|hum+|ben)\b[ ,]*/gi, "")
    .replace(/\bacouf[eè]nes?\b/gi, "acouphènes")
    .replace(/\bc[ée]rumens?\b/gi, "cérumen")
    .replace(/\s+([,.])/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
  t = t.replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

export class MockAiProvider implements AiProvider {
  readonly mode = "mock" as const;

  async extract(file: AiFile): Promise<AiResult> {
    await delay(1800);
    const demo = readDemoMarker(file.data);
    const raw = demo ?? genericExtraction(file.data.length);
    return { raw, usage: usage(env().AI_MODEL_VISION, 2800, 900) };
  }

  async writeComment(req: CommentRequest): Promise<AiResult> {
    await delay(900);
    return { raw: { comment: mockComment(req.facts, req.style) }, usage: usage(env().AI_MODEL_TEXT, 700, 180) };
  }

  async reformulateMotif(notes: string): Promise<AiResult> {
    await delay(600);
    return { raw: { motif: mockMotif(notes) }, usage: usage(env().AI_MODEL_TEXT, 350, 60) };
  }

  async ping() {}

  async cleanDictation(text: string): Promise<AiResult> {
    await delay(400);
    return { raw: { text: mockDictation(text) }, usage: usage(env().AI_MODEL_TEXT, 300, 80) };
  }
}
