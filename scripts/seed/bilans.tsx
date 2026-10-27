/**
 * Bilans auditifs FICTIFS au format « export de logiciel d'audiologie » (PDF) et photo (JPEG),
 * avec la vérité terrain intégrée (métadonnées) pour que le mode démo relise les bonnes valeurs.
 */
import { Fragment } from "react";
import { Document, Page, Path, Rect, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { DEMO_MARKER } from "@/ai/mock";
import { fromAudiometry } from "@/ai/extraction-schema";
import {
  CHART_FREQS,
  CHART_MAJOR,
  DB_MAX,
  DB_MIN,
  earSeries,
  freeFieldSeries,
  freqLabel,
  markerPath,
  noResponseArrow,
  polyline,
  xForFreq,
  yForDb,
  type ChartSeries,
} from "@/lib/audiology/chart";
import { emptyAudiometry, type Audiometry, type Confidence, type Curve } from "@/lib/schemas/audiometry";
import { registerFonts } from "@/lib/pdf/fonts";

export interface DemoBilan {
  file: string;
  format: "pdf" | "jpg";
  patient: { civility: string; firstName: string; lastName: string; birthDate: string };
  examDate: string;
  audiometry: Audiometry;
}

function c(values: Record<string, number | "NR">, conf: Confidence = "high", low: string[] = []): Curve {
  return Object.fromEntries(
    Object.entries(values).map(([f, v]) => [
      f,
      v === "NR"
        ? { value: 120, confidence: conf, noResponse: true }
        : { value: v, confidence: low.includes(f) ? "low" : conf },
    ]),
  );
}

function speech(srt: number | null, max: number | null, level: number | null, conf: Confidence = "high") {
  const m = (v: number | null) => (v === null ? null : { value: v, confidence: conf });
  return { srt: m(srt), maxScore: m(max), maxScoreLevel: m(level) };
}

function audiometry(def: {
  rAir: Record<string, number | "NR">;
  lAir: Record<string, number | "NR">;
  rBone: Record<string, number | "NR">;
  lBone: Record<string, number | "NR">;
  ffU: Record<string, number>;
  ffA: Record<string, number>;
  conf?: Confidence;
  low?: string[];
  sU?: [number, number, number];
  sA?: [number, number, number];
  sR?: [number, number, number];
  sL?: [number, number, number];
  noise?: { name: string; u: number; a: number };
}): Audiometry {
  const a = emptyAudiometry();
  const conf = def.conf ?? "high";
  a.right.air = c(def.rAir, conf, def.low);
  a.left.air = c(def.lAir, conf, def.low);
  a.right.bone = c(def.rBone, conf);
  a.left.bone = c(def.lBone, conf);
  a.freeField.unaided = c(def.ffU, conf);
  a.freeField.aided = c(def.ffA, conf, def.low);
  if (def.sR) a.right.speech = speech(...def.sR, conf);
  if (def.sL) a.left.speech = speech(...def.sL, conf);
  if (def.sU) a.freeField.speechUnaided = speech(...def.sU, conf);
  if (def.sA) a.freeField.speechAided = speech(...def.sA, conf);
  if (def.noise) {
    a.noise = {
      testName: def.noise.name,
      unaidedSnr: { value: def.noise.u, confidence: conf },
      aidedSnr: { value: def.noise.a, confidence: conf },
      unaidedScore: null,
      aidedScore: null,
    };
  }
  return a;
}

export const DEMO_BILANS: DemoBilan[] = [
  {
    file: "bilan-durand-jeanne.pdf",
    format: "pdf",
    patient: { civility: "Mme", firstName: "Jeanne", lastName: "Durand", birthDate: "1946-03-12" },
    examDate: "2026-09-29",
    audiometry: audiometry({
      rAir: { "125": 20, "250": 25, "500": 35, "1000": 45, "2000": 55, "3000": 60, "4000": 65, "6000": 70, "8000": 75 },
      lAir: { "125": 15, "250": 20, "500": 30, "1000": 40, "2000": 50, "3000": 60, "4000": 70, "6000": 75, "8000": 80 },
      rBone: { "250": 20, "500": 30, "1000": 40, "2000": 50, "4000": 60 },
      lBone: { "250": 15, "500": 25, "1000": 35, "2000": 45, "4000": 60 },
      ffU: { "250": 30, "500": 40, "1000": 45, "2000": 55, "4000": 65 },
      ffA: { "250": 25, "500": 25, "1000": 25, "2000": 30, "4000": 40 },
      sR: [50, 80, 75],
      sL: [45, 85, 75],
      sU: [55, 60, 70],
      sA: [35, 90, 60],
      noise: { name: "Test de phrases dans le bruit", u: 9, a: 4 },
    }),
  },
  {
    file: "bilan-martin-robert.pdf",
    format: "pdf",
    patient: { civility: "M.", firstName: "Robert", lastName: "Martin", birthDate: "1941-11-02" },
    examDate: "2026-10-06",
    audiometry: audiometry({
      rAir: { "250": 40, "500": 50, "1000": 60, "2000": 70, "3000": 75, "4000": 80, "8000": "NR" },
      lAir: { "250": 35, "500": 45, "1000": 55, "2000": 65, "3000": 75, "4000": 85, "8000": "NR" },
      rBone: { "500": 45, "1000": 55, "2000": 65, "4000": 70 },
      lBone: { "500": 40, "1000": 50, "2000": 60, "4000": 70 },
      ffU: { "250": 45, "500": 55, "1000": 60, "2000": 65, "4000": 75 },
      ffA: { "250": 35, "500": 35, "1000": 35, "2000": 40, "4000": 50 },
      sU: [65, 40, 80],
      sA: [40, 75, 65],
    }),
  },
  {
    file: "photo-bilan-petitjean-gerard.jpg",
    format: "jpg",
    patient: { civility: "M.", firstName: "Gérard", lastName: "Petitjean", birthDate: "1938-01-30" },
    examDate: "2026-10-10",
    audiometry: audiometry({
      rAir: { "250": 45, "500": 55, "1000": 65, "2000": 70, "4000": 85, "8000": 95 },
      lAir: { "250": 25, "500": 30, "1000": 35, "2000": 45, "4000": 60, "8000": 70 },
      rBone: { "500": 50, "1000": 60, "2000": 65, "4000": 75 },
      lBone: { "500": 25, "1000": 30, "2000": 40, "4000": 55 },
      ffU: { "500": 40, "1000": 45, "2000": 55, "4000": 70 },
      ffA: { "500": 30, "1000": 30, "2000": 35, "4000": 50 },
      conf: "medium",
      low: ["8000", "4000"],
      sU: [55, 65, 70],
      sA: [40, 85, 60],
    }),
  },
  {
    file: "photo-bilan-lefort-monique.jpg",
    format: "jpg",
    patient: { civility: "Mme", firstName: "Monique", lastName: "Lefort", birthDate: "1950-07-25" },
    examDate: "2026-10-14",
    audiometry: audiometry({
      rAir: { "250": 25, "500": 30, "1000": 35, "2000": 40, "4000": 55, "8000": 65 },
      lAir: { "250": 25, "500": 30, "1000": 40, "2000": 45, "4000": 55, "8000": 70 },
      rBone: { "500": 25, "1000": 30, "2000": 40, "4000": 50 },
      lBone: { "500": 25, "1000": 35, "2000": 40, "4000": 50 },
      ffU: { "500": 35, "1000": 40, "2000": 45, "4000": 55 },
      ffA: { "500": 25, "1000": 25, "2000": 30, "4000": 40 },
      conf: "medium",
      low: ["250"],
      sU: [45, 75, 65],
      sA: [30, 95, 55],
    }),
  },
];

const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

function markerFor(b: DemoBilan) {
  return `${DEMO_MARKER}${Buffer.from(JSON.stringify(fromAudiometry(b.audiometry))).toString("base64")}`;
}

/* ---------- Version PDF (style « logiciel d'audiologie », sans rapport avec la marque) ---------- */

function PdfChart({ x, y, title, series }: { x: number; y: number; title: string; series: ChartSeries[] }) {
  const w = 250;
  const h = 170;
  const cx0 = 26;
  const cw = w - 32;
  return (
    <View style={{ position: "absolute", left: x, top: y, width: w, height: h + 30 }}>
      <Text style={{ fontSize: 9, fontWeight: 700, color: "#334155", marginBottom: 3 }}>{title}</Text>
      <Svg width={w} height={h + 14} viewBox={`0 0 ${w} ${h + 14}`}>
        <Rect x={cx0} y={2} width={cw} height={h} fill="#ffffff" stroke="#64748b" strokeWidth={0.6} />
        {Array.from({ length: (DB_MAX - DB_MIN) / 10 + 1 }, (_, i) => DB_MIN + i * 10).map((db) => (
          <Path
            key={db}
            d={`M ${cx0} ${yForDb(db, 2, h)} L ${cx0 + cw} ${yForDb(db, 2, h)}`}
            stroke="#cbd5e1"
            strokeWidth={0.4}
          />
        ))}
        {CHART_FREQS.map((f) => (
          <Path
            key={f}
            d={`M ${xForFreq(Number(f), cx0, cw)} 2 L ${xForFreq(Number(f), cx0, cw)} ${h + 2}`}
            stroke="#cbd5e1"
            strokeWidth={0.4}
          />
        ))}
        {series.map((s) => (
          <Fragment key={s.key}>
            <Path
              d={polyline(s, cx0, 2, cw, h)}
              fill="none"
              stroke={s.color}
              strokeWidth={1}
              strokeDasharray={s.dashed ? "3,2" : undefined}
            />
            {s.points.map((p) => (
              <Fragment key={p.freq}>
                <Path
                  d={markerPath(s.marker, xForFreq(p.freq, cx0, cw), yForDb(p.db, 2, h), 3.3)}
                  fill={s.marker === "O" ? "#ffffff" : "none"}
                  stroke={s.color}
                  strokeWidth={1.1}
                />
                {p.noResponse ? (
                  <Path
                    d={noResponseArrow(xForFreq(p.freq, cx0, cw), yForDb(p.db, 2, h), 3.3)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={0.9}
                  />
                ) : null}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </Svg>
      {CHART_MAJOR.map((f) => (
        <Text
          key={f}
          style={{
            position: "absolute",
            left: xForFreq(Number(f), cx0, cw) - 12,
            top: h + 18,
            width: 24,
            textAlign: "center",
            fontSize: 6,
            color: "#475569",
          }}
        >
          {freqLabel(f)}
        </Text>
      ))}
      {[0, 20, 40, 60, 80, 100].map((db) => (
        <Text
          key={db}
          style={{
            position: "absolute",
            left: 0,
            top: 12 + yForDb(db, 2, h) - 3,
            width: 22,
            textAlign: "right",
            fontSize: 6,
            color: "#475569",
          }}
        >
          {String(db)}
        </Text>
      ))}
    </View>
  );
}

function cell(m: { value: number | null; noResponse?: boolean } | undefined) {
  if (!m) return "";
  return m.noResponse ? "NR" : m.value === null ? "" : String(m.value);
}

function BilanPdf({ b }: { b: DemoBilan }) {
  const a = b.audiometry;
  const freqs = ["125", "250", "500", "1000", "2000", "3000", "4000", "6000", "8000"] as const;
  const rows: [string, Curve][] = [
    ["OD aérienne", a.right.air],
    ["OD osseuse", a.right.bone],
    ["OG aérienne", a.left.air],
    ["OG osseuse", a.left.bone],
    ["CL sans appareil", a.freeField.unaided],
    ["CL avec appareils", a.freeField.aided],
  ];
  const sp = (s: typeof a.right.speech) => [
    cell(s.srt ?? undefined),
    cell(s.maxScore ?? undefined),
    cell(s.maxScoreLevel ?? undefined),
  ];
  return (
    <Document
      title="Bilan audiométrique"
      keywords={markerFor(b)}
      creator="AudioSoft Démo (fictif)"
      producer="AudioSoft Démo (fictif)"
    >
      <Page size="A4" style={{ fontFamily: "Inter", fontSize: 8.5, color: "#0f172a", padding: 32 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: "#0f766e",
            paddingBottom: 6,
          }}
        >
          <View>
            <Text style={{ fontSize: 14, fontWeight: 700, color: "#0f766e" }}>BILAN AUDIOMÉTRIQUE</Text>
            <Text style={{ color: "#475569" }}>AudioSoft Démo — document fictif généré pour la démonstration</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text>{`Examen du ${fmtDate(b.examDate)}`}</Text>
            <Text>Audiomètre : AS-200 (étalonné 01/2026)</Text>
          </View>
        </View>
        <View style={{ marginTop: 6, flexDirection: "row", gap: 20 }}>
          <Text>{`Patient : ${b.patient.civility} ${b.patient.lastName.toUpperCase()} ${b.patient.firstName}`}</Text>
          <Text>{`Né(e) le ${fmtDate(b.patient.birthDate)}`}</Text>
          <Text>Dossier n° DEMO-{b.patient.lastName.slice(0, 3).toUpperCase()}-0001</Text>
        </View>
        <PdfChart x={32} y={92} title="Oreille droite" series={earSeries(a, "right")} />
        <PdfChart x={305} y={92} title="Oreille gauche" series={earSeries(a, "left")} />
        <View style={{ position: "absolute", left: 32, top: 312, width: 531 }}>
          <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>Audiométrie tonale (dB HL)</Text>
          <View style={{ flexDirection: "row", backgroundColor: "#e2e8f0", paddingVertical: 2 }}>
            <Text style={{ width: 90, paddingLeft: 3, fontWeight: 700 }}>Hz</Text>
            {freqs.map((f) => (
              <Text key={f} style={{ width: 48, textAlign: "center", fontWeight: 700 }}>
                {f}
              </Text>
            ))}
          </View>
          {rows.map(([label, curve]) => (
            <View
              key={label}
              style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1", paddingVertical: 2 }}
            >
              <Text style={{ width: 90, paddingLeft: 3 }}>{label}</Text>
              {freqs.map((f) => (
                <Text key={f} style={{ width: 48, textAlign: "center" }}>
                  {cell(curve[f])}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <PdfChart x={32} y={470} title="Champ libre (S sans / A avec)" series={freeFieldSeries(a)} />
        <View style={{ position: "absolute", left: 305, top: 470, width: 258 }}>
          <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>Audiométrie vocale (listes de Fournier)</Text>
          <View style={{ flexDirection: "row", backgroundColor: "#e2e8f0", paddingVertical: 2 }}>
            <Text style={{ width: 88, paddingLeft: 3, fontWeight: 700 }} />
            <Text style={{ width: 56, textAlign: "center", fontWeight: 700 }}>SRT (dB)</Text>
            <Text style={{ width: 56, textAlign: "center", fontWeight: 700 }}>Max (%)</Text>
            <Text style={{ width: 56, textAlign: "center", fontWeight: 700 }}>à (dB)</Text>
          </View>
          {(
            [
              ["OD casque", a.right.speech],
              ["OG casque", a.left.speech],
              ["CL sans", a.freeField.speechUnaided],
              ["CL avec", a.freeField.speechAided],
            ] as const
          ).map(([label, s]) => (
            <View
              key={label}
              style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1", paddingVertical: 2 }}
            >
              <Text style={{ width: 88, paddingLeft: 3 }}>{label}</Text>
              {sp(s).map((v, i) => (
                <Text key={i} style={{ width: 56, textAlign: "center" }}>
                  {v}
                </Text>
              ))}
            </View>
          ))}
          {a.noise ? (
            <Text
              style={{ marginTop: 8 }}
            >{`${a.noise.testName} : RSB 50 % sans ${cell(a.noise.unaidedSnr ?? undefined)} dB / avec ${cell(a.noise.aidedSnr ?? undefined)} dB`}</Text>
          ) : null}
          <Text style={{ marginTop: 10, color: "#475569" }}>
            Masquage controlatéral appliqué si nécessaire. Résultats non interprétés.
          </Text>
        </View>
        <Text style={{ position: "absolute", left: 32, bottom: 24, fontSize: 7, color: "#64748b" }}>
          Données entièrement fictives — LIAISON ORL, jeu de démonstration.
        </Text>
      </Page>
    </Document>
  );
}

/* ---------- Version photo (SVG → JPEG légèrement de travers, comme une photo de bilan papier) ---------- */

function svgChart(x: number, y: number, title: string, series: ChartSeries[]): string {
  const w = 520;
  const h = 360;
  const cx0 = 50;
  const cw = w - 70;
  let out = `<text x="${x}" y="${y - 8}" font-size="22" font-family="Arial" font-weight="bold" fill="#334155">${title}</text>`;
  out += `<rect x="${x + cx0}" y="${y}" width="${cw}" height="${h}" fill="#fff" stroke="#64748b" stroke-width="1.5"/>`;
  for (let db = DB_MIN; db <= DB_MAX; db += 10) {
    const yy = y + yForDb(db, 0, h);
    out += `<line x1="${x + cx0}" x2="${x + cx0 + cw}" y1="${yy}" y2="${yy}" stroke="#cbd5e1"/>`;
    if (db % 20 === 0 && db < DB_MAX)
      out += `<text x="${x + cx0 - 8}" y="${yy + 6}" font-size="15" text-anchor="end" font-family="Arial" fill="#475569">${db}</text>`;
  }
  for (const f of CHART_FREQS) {
    const xx = x + xForFreq(Number(f), cx0, cw);
    out += `<line x1="${xx}" x2="${xx}" y1="${y}" y2="${y + h}" stroke="#cbd5e1"/>`;
  }
  for (const f of CHART_MAJOR)
    out += `<text x="${x + xForFreq(Number(f), cx0, cw)}" y="${y + h + 22}" font-size="15" text-anchor="middle" font-family="Arial" fill="#475569">${freqLabel(f)}</text>`;
  for (const s of series) {
    const pts = s.points
      .filter((p) => !p.noResponse)
      .map((p) => `${x + xForFreq(p.freq, cx0, cw)},${y + yForDb(p.db, 0, h)}`);
    if (pts.length)
      out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5"${s.dashed ? ' stroke-dasharray="8 5"' : ""}/>`;
    for (const p of s.points) {
      out += `<path d="${markerPath(s.marker, x + xForFreq(p.freq, cx0, cw), y + yForDb(p.db, 0, h), 8)}" fill="${s.marker === "O" ? "#fff" : "none"}" stroke="${s.color}" stroke-width="2.8"/>`;
    }
  }
  return out;
}

async function bilanJpeg(b: DemoBilan): Promise<Buffer> {
  const a = b.audiometry;
  const W = 1240;
  const H = 1754;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fbfaf7"/>`;
  svg += `<text x="70" y="90" font-size="36" font-family="Arial" font-weight="bold" fill="#0f766e">BILAN AUDIOMÉTRIQUE</text>`;
  svg += `<text x="70" y="130" font-size="20" font-family="Arial" fill="#334155">Patient : ${b.patient.civility} ${b.patient.lastName.toUpperCase()} ${b.patient.firstName} — né(e) le ${fmtDate(b.patient.birthDate)} — examen du ${fmtDate(b.examDate)}</text>`;
  svg += svgChart(70, 200, "Oreille droite", earSeries(a, "right"));
  svg += svgChart(650, 200, "Oreille gauche", earSeries(a, "left"));
  svg += svgChart(70, 700, "Champ libre S / A", freeFieldSeries(a));
  const lines = [
    `CL sans : SRT ${cell(a.freeField.speechUnaided.srt ?? undefined)} dB — max ${cell(a.freeField.speechUnaided.maxScore ?? undefined)} %`,
    `CL avec : SRT ${cell(a.freeField.speechAided.srt ?? undefined)} dB — max ${cell(a.freeField.speechAided.maxScore ?? undefined)} %`,
    "Document fictif — démonstration",
  ];
  lines.forEach(
    (l, i) =>
      (svg += `<text x="660" y="${760 + i * 40}" font-size="22" font-family="Arial" fill="#0f172a">${l}</text>`),
  );
  svg += "</svg>";
  return sharp(Buffer.from(svg))
    .rotate(-2.2, { background: "#d6d3cc" })
    .modulate({ brightness: 0.96, saturation: 0.9 })
    .blur(0.6)
    .resize({ width: 1400 })
    .jpeg({ quality: 82 })
    .withExif({ IFD0: { ImageDescription: markerFor(b) } })
    .toBuffer();
}

export async function renderDemoBilan(
  b: DemoBilan,
): Promise<{ data: Buffer; mimeType: "application/pdf" | "image/jpeg" }> {
  if (b.format === "pdf") {
    registerFonts();
    return { data: await renderToBuffer(<BilanPdf b={b} />), mimeType: "application/pdf" };
  }
  return { data: await bilanJpeg(b), mimeType: "image/jpeg" };
}
