import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageProvider } from "./types";

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

/** Stockage AWS S3 (bucket privé, chiffrement côté serveur ; les fichiers sont servis par l'application après contrôle des droits). */
export class S3Storage implements StorageProvider {
  readonly name = "s3" as const;
  readonly mode = "live" as const;
  private readonly client: S3Client;

  constructor(private readonly cfg: S3Config) {
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: Boolean(cfg.endpoint),
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
        CacheControl: "private, no-store",
      }),
    );
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }


  async ping() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.cfg.bucket }));
  }
}
