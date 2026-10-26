import "server-only";
import { GridFSBucket } from "mongodb";
import { db } from "@/lib/db/client";
import type { StorageProvider } from "./types";

/** Stockage de démonstration dans MongoDB (GridFS) pour les environnements sans disque persistant (Vercel). */
export class GridFsStorage implements StorageProvider {
  readonly name = "gridfs" as const;
  readonly mode = "mock" as const;

  private bucket() {
    return new GridFSBucket(db(), { bucketName: "files" });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.delete(key);
    await new Promise<void>((resolve, reject) => {
      const stream = this.bucket().openUploadStream(key, { metadata: { contentType } });
      stream.on("error", reject);
      stream.on("finish", () => resolve());
      stream.end(body);
    });
  }

  async get(key: string) {
    const files = await this.bucket().find({ filename: key }).sort({ uploadDate: -1 }).limit(1).toArray();
    const file = files[0];
    if (!file) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of this.bucket().openDownloadStream(file._id)) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async delete(key: string) {
    const files = await this.bucket().find({ filename: key }).toArray();
    for (const f of files) await this.bucket().delete(f._id);
  }


  async ping() {
    await db().command({ ping: 1 });
  }
}
