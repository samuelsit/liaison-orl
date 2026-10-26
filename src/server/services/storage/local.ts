import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageProvider } from "./types";

function safePath(root: string, key: string): string {
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error("Clé de fichier invalide");
  return resolved;
}

/** Stockage sur disque local (développement / démo). */
export class LocalStorage implements StorageProvider {
  readonly name = "local" as const;
  readonly mode = "mock" as const;
  constructor(private readonly root: string) {}

  async put(key: string, body: Buffer, _contentType: string) {
    const p = safePath(this.root, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  async get(key: string) {
    try {
      return await fs.readFile(safePath(this.root, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string) {
    await fs.rm(safePath(this.root, key), { force: true });
  }


  async ping() {
    await fs.mkdir(this.root, { recursive: true });
  }
}
