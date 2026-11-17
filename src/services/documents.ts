import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, type DB } from "@/db/client";
import {
  documents,
  documentShares,
  users,
  EMPTY_DOC,
  type AccessRole,
  type ShareRole,
  type TiptapDoc,
} from "@/db/schema";
import { assertCan, type DocAccess } from "@/lib/access";
import { AppError, notFound } from "@/lib/errors";
import { docToText } from "@/lib/tiptap-text";
import type { UpdateDocInput } from "@/lib/validation";

export type DocSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: Date;
};
export type OwnedDocSummary = DocSummary & { shareCount: number };
export type SharedDocSummary = DocSummary & {
  role: ShareRole;
  owner: { name: string; email: string; avatarColor: string };
};

const PREVIEW_CHARS = 140;
const preview = sql<string>`left(${documents.contentText}, ${PREVIEW_CHARS})`;

/** Dashboard data: documents I own and documents shared with me, newest first. */
export async function listForUser(
  userId: string,
  db: DB = getDb(),
): Promise<{ owned: OwnedDocSummary[]; shared: SharedDocSummary[] }> {
  const [owned, shared] = await Promise.all([
    db
      .select({
        id: documents.id,
        title: documents.title,
        preview,
        updatedAt: documents.updatedAt,
        shareCount: sql<number>`(select count(*)::int from ${documentShares} where ${documentShares.documentId} = ${documents.id})`,
      })
      .from(documents)
      .where(eq(documents.ownerId, userId))
      .orderBy(desc(documents.updatedAt)),
    db
      .select({
        id: documents.id,
        title: documents.title,
        preview,
        updatedAt: documents.updatedAt,
        role: documentShares.role,
        owner: { name: users.name, email: users.email, avatarColor: users.avatarColor },
      })
      .from(documentShares)
      .innerJoin(documents, eq(documents.id, documentShares.documentId))
      .innerJoin(users, eq(users.id, documents.ownerId))
      .where(eq(documentShares.userId, userId))
      .orderBy(desc(documents.updatedAt)),
  ]);
  return { owned, shared };
}

export async function createDocument(
  userId: string,
  input: { title?: string; content?: TiptapDoc } = {},
  db: DB = getDb(),
) {
  const content = input.content ?? EMPTY_DOC;
  const [doc] = await db
    .insert(documents)
    .values({
      ownerId: userId,
      title: input.title ?? "Untitled document",
      content,
      contentText: docToText(content),
    })
    .returning();
  return doc;
}

export type DocumentView = DocAccess & {
  owner: { id: string; name: string; email: string };
};

export async function getDocument(userId: string, id: string, db: DB = getDb()): Promise<DocumentView> {
  const access = await assertCan(db, userId, id, "read");
  const [owner] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, access.doc.ownerId));
  return { ...access, owner };
}

/**
 * Optimistic concurrency: the write only lands if the client's `version` is
 * still current. Otherwise 409 CONFLICT with the current version, so a stale
 * tab can never silently overwrite someone else's edits.
 */
export async function updateDocument(
  userId: string,
  id: string,
  input: UpdateDocInput,
  db: DB = getDb(),
): Promise<{ version: number; updatedAt: Date; title: string; role: AccessRole }> {
  const { role } = await assertCan(db, userId, id, input.content !== undefined ? "edit" : "rename");

  const set: Partial<typeof documents.$inferInsert> = {
    version: sql`${documents.version} + 1` as unknown as number,
    updatedAt: sql`now()` as unknown as Date,
  };
  if (input.title !== undefined) set.title = input.title;
  if (input.content !== undefined) {
    set.content = input.content;
    set.contentText = docToText(input.content);
  }

  const [row] = await db
    .update(documents)
    .set(set)
    .where(and(eq(documents.id, id), eq(documents.version, input.version)))
    .returning({ version: documents.version, updatedAt: documents.updatedAt, title: documents.title });

  if (row) return { ...row, role };

  const [current] = await db
    .select({ version: documents.version })
    .from(documents)
    .where(eq(documents.id, id));
  if (!current) throw notFound("This document was deleted.");
  throw new AppError(
    "CONFLICT",
    409,
    "This document was changed somewhere else. Reload to get the latest version.",
    { currentVersion: current.version },
  );
}

export async function deleteDocument(userId: string, id: string, db: DB = getDb()): Promise<void> {
  await assertCan(db, userId, id, "delete");
  await db.delete(documents).where(eq(documents.id, id)); // shares cascade
}
