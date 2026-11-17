import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, para, seedUsers } from "./helpers/db";
import { documentShares } from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listForUser,
  updateDocument,
} from "@/services/documents";
import type { DB } from "@/db/client";

/**
 * Integration tests: real services + real SQL against PGlite (same migrations as Neon).
 * These cover the rules that matter most — who can do what, and never losing edits.
 */
let t: Awaited<ReturnType<typeof createTestDb>>;
let db: DB;
let u: Awaited<ReturnType<typeof seedUsers>>;

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
});
afterAll(async () => t.close());
beforeEach(async () => {
  await t.reset();
  u = await seedUsers(db);
});

async function share(docId: string, userId: string, role: "viewer" | "editor") {
  await db.insert(documentShares).values({ documentId: docId, userId, role, grantedBy: u.alice.id });
}

async function expectAppError(p: Promise<unknown>, code: string, status: number) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err, `expected ${code}`).toBeInstanceOf(AppError);
  expect(err.code).toBe(code);
  expect(err.status).toBe(status);
  return err as AppError;
}

describe("create + read", () => {
  it("creates an empty 'Untitled document' at version 1 owned by the creator", async () => {
    const doc = await createDocument(u.alice.id, {}, db);
    expect(doc.title).toBe("Untitled document");
    expect(doc.version).toBe(1);
    const view = await getDocument(u.alice.id, doc.id, db);
    expect(view.role).toBe("owner");
    expect(view.owner.email).toBe("alice@ajaia.dev");
  });

  it("hides documents from people without access (404, never 403)", async () => {
    const doc = await createDocument(u.alice.id, { title: "Private" }, db);
    await expectAppError(getDocument(u.dave.id, doc.id, db), "NOT_FOUND", 404);
  });

  it("treats a malformed id as not found instead of crashing", async () => {
    await expectAppError(getDocument(u.alice.id, "not-a-uuid", db), "NOT_FOUND", 404);
  });
});

describe("update: formatting persists + optimistic concurrency", () => {
  it("saves rich content, bumps the version and derives plain text server-side", async () => {
    const doc = await createDocument(u.alice.id, {}, db);
    const content = {
      type: "doc" as const,
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Plan" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }],
        },
      ],
    };
    const res = await updateDocument(u.alice.id, doc.id, { content, version: 1 }, db);
    expect(res.version).toBe(2);

    const { doc: saved } = await getDocument(u.alice.id, doc.id, db);
    expect(saved.content).toEqual(content); // structure + marks round-trip exactly
    expect(saved.contentText).toBe("Plan\nbold");
  });

  it("rejects a stale version with 409 CONFLICT and leaves the newer save intact", async () => {
    const doc = await createDocument(u.alice.id, {}, db);
    await share(doc.id, u.bob.id, "editor");

    // Alice and Bob both loaded version 1. Alice saves first.
    await updateDocument(u.alice.id, doc.id, { content: para("Alice's edit"), version: 1 }, db);

    // Bob's save is based on version 1 -> must not overwrite Alice.
    const err = await expectAppError(
      updateDocument(u.bob.id, doc.id, { content: para("Bob's stale edit"), version: 1 }, db),
      "CONFLICT",
      409,
    );
    expect(err.details).toEqual({ currentVersion: 2 });

    const { doc: saved } = await getDocument(u.alice.id, doc.id, db);
    expect(saved.contentText).toBe("Alice's edit");
  });

  it("renames also bump the version, so a stale content save after a rename is caught", async () => {
    const doc = await createDocument(u.alice.id, {}, db);
    const r = await updateDocument(u.alice.id, doc.id, { title: "Renamed", version: 1 }, db);
    expect(r.title).toBe("Renamed");
    await expectAppError(
      updateDocument(u.alice.id, doc.id, { content: para("x"), version: 1 }, db),
      "CONFLICT",
      409,
    );
  });

  it("returns 404 (not 409) when the document was deleted meanwhile", async () => {
    const doc = await createDocument(u.alice.id, {}, db);
    await deleteDocument(u.alice.id, doc.id, db);
    await expectAppError(
      updateDocument(u.alice.id, doc.id, { title: "x", version: 1 }, db),
      "NOT_FOUND",
      404,
    );
  });
});

describe("roles on shared documents", () => {
  it("editor can edit and rename but cannot delete", async () => {
    const doc = await createDocument(u.alice.id, {}, db);
    await share(doc.id, u.bob.id, "editor");
    const r1 = await updateDocument(u.bob.id, doc.id, { content: para("by bob"), version: 1 }, db);
    const r2 = await updateDocument(u.bob.id, doc.id, { title: "Bob's title", version: r1.version }, db);
    expect(r2.role).toBe("editor");
    await expectAppError(deleteDocument(u.bob.id, doc.id, db), "FORBIDDEN", 403);
  });

  it("viewer can read but cannot edit, rename or delete", async () => {
    const doc = await createDocument(u.alice.id, { title: "Read me" }, db);
    await share(doc.id, u.carol.id, "viewer");
    expect((await getDocument(u.carol.id, doc.id, db)).role).toBe("viewer");
    await expectAppError(
      updateDocument(u.carol.id, doc.id, { content: para("nope"), version: 1 }, db),
      "FORBIDDEN",
      403,
    );
    await expectAppError(
      updateDocument(u.carol.id, doc.id, { title: "nope", version: 1 }, db),
      "FORBIDDEN",
      403,
    );
    await expectAppError(deleteDocument(u.carol.id, doc.id, db), "FORBIDDEN", 403);
  });
});

describe("dashboard: owned vs shared", () => {
  it("separates my documents from documents shared with me, with role and owner", async () => {
    const mine = await createDocument(u.bob.id, { title: "Bob's own" }, db);
    const fromAlice = await createDocument(u.alice.id, { title: "From Alice" }, db);
    await createDocument(u.alice.id, { title: "Alice private" }, db);
    await share(fromAlice.id, u.bob.id, "viewer");

    const { owned, shared } = await listForUser(u.bob.id, db);
    expect(owned.map((d) => d.id)).toEqual([mine.id]);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({
      id: fromAlice.id,
      title: "From Alice",
      role: "viewer",
      owner: { name: "Alice Owner" },
    });
  });

  it("reports share counts on owned docs and orders by most recently edited", async () => {
    const older = await createDocument(u.alice.id, { title: "Older" }, db);
    const newer = await createDocument(u.alice.id, { title: "Newer" }, db);
    await share(older.id, u.bob.id, "editor");
    await share(older.id, u.carol.id, "viewer");
    await updateDocument(u.alice.id, older.id, { title: "Older (edited)", version: 1 }, db);

    const { owned } = await listForUser(u.alice.id, db);
    expect(owned.map((d) => d.title)).toEqual(["Older (edited)", "Newer"]);
    expect(owned.find((d) => d.id === older.id)?.shareCount).toBe(2);
    expect(owned.find((d) => d.id === newer.id)?.shareCount).toBe(0);
  });
});

describe("delete", () => {
  it("owner delete removes the doc and its shares (cascade)", async () => {
    const doc = await createDocument(u.alice.id, {}, db);
    await share(doc.id, u.bob.id, "editor");
    await deleteDocument(u.alice.id, doc.id, db);
    await expectAppError(getDocument(u.bob.id, doc.id, db), "NOT_FOUND", 404);
    expect((await listForUser(u.bob.id, db)).shared).toHaveLength(0);
  });
});
