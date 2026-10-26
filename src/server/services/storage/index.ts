import "server-only";
import path from "node:path";
import { env } from "@/lib/env";
import { GridFsStorage } from "./gridfs";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { StorageProvider } from "./types";

let instance: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (instance) return instance;
  const e = env();
  if (e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY) {
    instance = new S3Storage({
      bucket: e.S3_BUCKET,
      region: e.S3_REGION,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      endpoint: e.S3_ENDPOINT,
    });
  } else if (e.VERCEL) {
    instance = new GridFsStorage();
  } else {
    instance = new LocalStorage(path.resolve(process.cwd(), e.LOCAL_STORAGE_DIR));
  }
  return instance;
}

export function resetStorage() {
  instance = null;
}

export const storageKeys = {
  documentPdf: (orgId: string, docId: string, version: number, variant: "standard" | "postal" = "standard") =>
    `org/${orgId}/documents/${docId}/v${version}${variant === "postal" ? "-postal" : ""}.pdf`,
  attachment: (orgId: string, attachmentId: string, ext: string) => `org/${orgId}/attachments/${attachmentId}.${ext}`,
  proof: (orgId: string, dispatchId: string) => `org/${orgId}/proofs/${dispatchId}.pdf`,
  dispatchPdf: (orgId: string, dispatchId: string) => `org/${orgId}/dispatches/${dispatchId}.pdf`,
};

export type { StorageProvider } from "./types";
