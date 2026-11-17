import { and, asc, eq } from "drizzle-orm";
import { getDb, type DB } from "@/db/client";
import { documentShares, users, type ShareRole } from "@/db/schema";
import { assertCan } from "@/lib/access";
import { AppError, notFound } from "@/lib/errors";
import { uuidSchema, type ShareInput } from "@/lib/validation";
import { findUserByEmail, type PublicUser } from "./users";

export type ShareEntry = { user: PublicUser; role: ShareRole; createdAt: Date };
export type ShareList = { owner: PublicUser; shares: ShareEntry[] };

const publicUserCols = {
  id: users.id,
  email: users.email,
  name: users.name,
  avatarColor: users.avatarColor,
};

/** Anyone with read access can see who else has access (read-only for non-owners). */
export async function listShares(userId: string, docId: string, db: DB = getDb()): Promise<ShareList> {
  const { doc } = await assertCan(db, userId, docId, "read");
  const [[owner], rows] = await Promise.all([
    db.select(publicUserCols).from(users).where(eq(users.id, doc.ownerId)),
    db
      .select({ user: publicUserCols, role: documentShares.role, createdAt: documentShares.createdAt })
      .from(documentShares)
      .innerJoin(users, eq(users.id, documentShares.userId))
      .where(eq(documentShares.documentId, docId))
      .orderBy(asc(documentShares.createdAt)),
  ]);
  return { owner, shares: rows };
}

/**
 * Owner grants access by email, or changes the role if already shared (upsert).
 * Returns whether this created a new share so the UI can say "Shared" vs "Updated".
 */
export async function shareDocument(
  userId: string,
  docId: string,
  input: ShareInput,
  db: DB = getDb(),
): Promise<ShareEntry & { created: boolean }> {
  const { doc } = await assertCan(db, userId, docId, "share");

  const target = await findUserByEmail(input.email, db);
  if (!target) throw new AppError("USER_NOT_FOUND", 404, `No user with the email ${input.email}.`);
  if (target.id === doc.ownerId) {
    throw new AppError(
      "CANNOT_SHARE_WITH_OWNER",
      400,
      target.id === userId ? "You already own this document." : "That person owns this document.",
    );
  }

  const [existing] = await db
    .select({ role: documentShares.role })
    .from(documentShares)
    .where(and(eq(documentShares.documentId, docId), eq(documentShares.userId, target.id)));

  const [row] = await db
    .insert(documentShares)
    .values({ documentId: docId, userId: target.id, role: input.role, grantedBy: userId })
    .onConflictDoUpdate({
      target: [documentShares.documentId, documentShares.userId],
      set: { role: input.role, grantedBy: userId },
    })
    .returning({ role: documentShares.role, createdAt: documentShares.createdAt });

  return { user: target, role: row.role, createdAt: row.createdAt, created: !existing };
}

/** Owner removes someone's access. */
export async function revokeShare(
  userId: string,
  docId: string,
  targetUserId: string,
  db: DB = getDb(),
): Promise<void> {
  await assertCan(db, userId, docId, "share");
  if (!uuidSchema.safeParse(targetUserId).success) throw notFound("That person doesn't have access.");
  const removed = await db
    .delete(documentShares)
    .where(and(eq(documentShares.documentId, docId), eq(documentShares.userId, targetUserId)))
    .returning({ userId: documentShares.userId });
  if (removed.length === 0) throw notFound("That person doesn't have access.");
}
