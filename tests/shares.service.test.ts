import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, para, seedUsers } from "./helpers/db";
import { AppError } from "@/lib/errors";
import { createDocument, getDocument, listForUser, updateDocument } from "@/services/documents";
import { listShares, revokeShare, shareDocument } from "@/services/shares";
import type { DB } from "@/db/client";

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: DB;
let u: Awaited<ReturnType<typeof seedUsers>>;
let docId: string;

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
});
afterAll(async () => t.close());
beforeEach(async () => {
  await t.reset();
  u = await seedUsers(db);
  docId = (await createDocument(u.alice.id, { title: "Q4 Planning" }, db)).id;
});

async function expectAppError(p: Promise<unknown>, code: string, status: number) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err, `expected ${code}`).toBeInstanceOf(AppError);
  expect({ code: err.code, status: err.status }).toEqual({ code, status });
}

describe("sharing flow (owner grants, recipient sees it)", () => {
  it("owner shares by email; recipient gains access and sees it under 'Shared with me'", async () => {
    await expectAppError(getDocument(u.bob.id, docId, db), "NOT_FOUND", 404);

    const res = await shareDocument(u.alice.id, docId, { email: "bob@ajaia.dev", role: "editor" }, db);
    expect(res).toMatchObject({ created: true, role: "editor", user: { email: "bob@ajaia.dev" } });

    expect((await getDocument(u.bob.id, docId, db)).role).toBe("editor");
    const { shared } = await listForUser(u.bob.id, db);
    expect(shared.map((d) => d.title)).toEqual(["Q4 Planning"]);
  });

  it("matches emails case-insensitively (input is normalised)", async () => {
    // shareSchema lowercases; the service also lowercases lookups defensively.
    const res = await shareDocument(u.alice.id, docId, { email: "BOB@Ajaia.dev", role: "viewer" }, db);
    expect(res.user.email).toBe("bob@ajaia.dev");
  });

  it("sharing again with the same person updates the role instead of duplicating", async () => {
    await shareDocument(u.alice.id, docId, { email: "bob@ajaia.dev", role: "editor" }, db);
    const again = await shareDocument(u.alice.id, docId, { email: "bob@ajaia.dev", role: "viewer" }, db);
    expect(again).toMatchObject({ created: false, role: "viewer" });

    const { shares } = await listShares(u.alice.id, docId, db);
    expect(shares.map((s) => [s.user.email, s.role])).toEqual([["bob@ajaia.dev", "viewer"]]);
  });

  it("downgrading an editor to viewer takes away their ability to save", async () => {
    await shareDocument(u.alice.id, docId, { email: "bob@ajaia.dev", role: "editor" }, db);
    await updateDocument(u.bob.id, docId, { content: para("ok"), version: 1 }, db);
    await shareDocument(u.alice.id, docId, { email: "bob@ajaia.dev", role: "viewer" }, db);
    await expectAppError(
      updateDocument(u.bob.id, docId, { content: para("blocked"), version: 2 }, db),
      "FORBIDDEN",
      403,
    );
  });
});

describe("sharing validation", () => {
  it("rejects unknown users with USER_NOT_FOUND", async () => {
    await expectAppError(
      shareDocument(u.alice.id, docId, { email: "nobody@ajaia.dev", role: "viewer" }, db),
      "USER_NOT_FOUND",
      404,
    );
  });

  it("rejects sharing with the owner", async () => {
    await expectAppError(
      shareDocument(u.alice.id, docId, { email: "alice@ajaia.dev", role: "editor" }, db),
      "CANNOT_SHARE_WITH_OWNER",
      400,
    );
  });

  it("only the owner can share or revoke — editors and viewers get 403, strangers 404", async () => {
    await shareDocument(u.alice.id, docId, { email: "bob@ajaia.dev", role: "editor" }, db);
    await shareDocument(u.alice.id, docId, { email: "carol@ajaia.dev", role: "viewer" }, db);

    await expectAppError(
      shareDocument(u.bob.id, docId, { email: "dave@ajaia.dev", role: "viewer" }, db),
      "FORBIDDEN",
      403,
    );
    await expectAppError(revokeShare(u.carol.id, docId, u.bob.id, db), "FORBIDDEN", 403);
    await expectAppError(
      shareDocument(u.dave.id, docId, { email: "dave@ajaia.dev", role: "editor" }, db),
      "NOT_FOUND",
      404,
    );
  });
});

describe("listing and revoking", () => {
  it("anyone with access can see who has access; strangers cannot", async () => {
    await shareDocument(u.alice.id, docId, { email: "carol@ajaia.dev", role: "viewer" }, db);
    const asCarol = await listShares(u.carol.id, docId, db);
    expect(asCarol.owner.email).toBe("alice@ajaia.dev");
    expect(asCarol.shares.map((s) => s.user.email)).toEqual(["carol@ajaia.dev"]);
    await expectAppError(listShares(u.dave.id, docId, db), "NOT_FOUND", 404);
  });

  it("revoking removes access immediately; revoking twice is a 404", async () => {
    await shareDocument(u.alice.id, docId, { email: "bob@ajaia.dev", role: "editor" }, db);
    await revokeShare(u.alice.id, docId, u.bob.id, db);
    await expectAppError(getDocument(u.bob.id, docId, db), "NOT_FOUND", 404);
    expect((await listForUser(u.bob.id, db)).shared).toHaveLength(0);
    await expectAppError(revokeShare(u.alice.id, docId, u.bob.id, db), "NOT_FOUND", 404);
    await expectAppError(revokeShare(u.alice.id, docId, "not-a-uuid", db), "NOT_FOUND", 404);
  });
});
