import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

let cached: Buffer | null = null;

/** Worker pdf.js servi depuis l'application (même origine, compatible CSP). */
export async function GET() {
  cached ??= await readFile(path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"));
  return new Response(new Uint8Array(cached), {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
