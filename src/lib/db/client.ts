import "server-only";
import { MongoClient, type Db } from "mongodb";
import { mongoDbName, mongoUri } from "@/lib/env";

interface MongoCache {
  client: MongoClient | null;
  uri: string | null;
}

const globalForMongo = globalThis as unknown as { __lorlMongo?: MongoCache };
const cache: MongoCache = globalForMongo.__lorlMongo ?? { client: null, uri: null };
globalForMongo.__lorlMongo = cache;

/** Client MongoDB partagé (réutilisé entre les invocations et le rechargement à chaud). */
export function mongoClient(): MongoClient {
  const uri = mongoUri();
  if (!cache.client || cache.uri !== uri) {
    cache.client = new MongoClient(uri, {
      appName: "liaison-orl",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
    cache.uri = uri;
  }
  return cache.client;
}

export function db(): Db {
  return mongoClient().db(mongoDbName());
}

export async function closeDb() {
  if (cache.client) {
    await cache.client.close();
    cache.client = null;
    cache.uri = null;
  }
}
