import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { DB } from "@/db/client";

/**
 * A real Postgres engine (PGlite, in-process) with the SAME migrations we run
 * against Neon. Services take `db` as a parameter, so tests exercise the exact
 * production SQL (joins, upserts, conditional updates) without any network.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return {
    // Same query-builder API as the Neon HTTP driver; only the transport differs.
    db: db as unknown as DB,
    async reset() {
      await db.execute(sql`truncate table document_shares, documents, users cascade`);
    },
    async close() {
      await client.close();
    },
  };
}

export async function seedUsers(db: DB) {
  const rows = await db
    .insert(schema.users)
    .values([
      { email: "alice@ajaia.dev", name: "Alice Owner" },
      { email: "bob@ajaia.dev", name: "Bob Editor" },
      { email: "carol@ajaia.dev", name: "Carol Viewer" },
      { email: "dave@ajaia.dev", name: "Dave Stranger" },
    ])
    .returning();
  const by = (email: string) => rows.find((r) => r.email === email)!;
  return {
    alice: by("alice@ajaia.dev"),
    bob: by("bob@ajaia.dev"),
    carol: by("carol@ajaia.dev"),
    dave: by("dave@ajaia.dev"),
  };
}

export const para = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
