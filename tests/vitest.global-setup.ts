import { existsSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

let server: MongoMemoryServer | null = null;

/** Base MongoDB éphémère pour les tests (binaire système si disponible). */
export async function setup() {
  for (const candidate of ["/opt/homebrew/bin/mongod", "/usr/local/bin/mongod", "/usr/bin/mongod"]) {
    if (!process.env.MONGOMS_SYSTEM_BINARY && existsSync(candidate)) process.env.MONGOMS_SYSTEM_BINARY = candidate;
  }
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("liaison-orl-test");
  process.env.MONGODB_DB = "liaison-orl-test";
}

export async function teardown() {
  await server?.stop();
}
