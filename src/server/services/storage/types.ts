export interface StorageProvider {
  readonly name: "s3" | "local" | "gridfs";
  readonly mode: "live" | "mock";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  ping(): Promise<void>;
}
