import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { documents, documentShares, type AccessRole, type Document } from "@/db/schema";
import { forbidden, notFound } from "./errors";
import { uuidSchema } from "./validation";

/**
 * Single source of truth for document authorization. Every read/write of a
 * document goes through getDocAccess/assertCan — nothing else decides access.
 */
export type Capability = "read" | "edit" | "rename" | "share" | "delete";

const MATRIX: Record<AccessRole, readonly Capability[]> = {
  owner: ["read", "edit", "rename", "share", "delete"],
  editor: ["read", "edit", "rename"],
  viewer: ["read"],
};

export function can(role: AccessRole | null | undefined, cap: Capability): boolean {
  return !!role && MATRIX[role].includes(cap);
}

export type DocAccess = { doc: Document; role: AccessRole };

/** One query: the document plus this user's share row (if any). Null = no access. */
export async function getDocAccess(db: DB, userId: string, docId: string): Promise<DocAccess | null> {
  if (!uuidSchema.safeParse(docId).success) return null; // malformed id == not found
  const [row] = await db
    .select({ doc: documents, shareRole: documentShares.role })
    .from(documents)
    .leftJoin(
      documentShares,
      and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)),
    )
    .where(eq(documents.id, docId))
    .limit(1);
  if (!row) return null;
  if (row.doc.ownerId === userId) return { doc: row.doc, role: "owner" };
  if (row.shareRole) return { doc: row.doc, role: row.shareRole };
  return null;
}

/**
 * Throws 404 when the user has no access at all (never confirm a doc exists),
 * 403 when they can see it but lack the capability.
 */
export async function assertCan(
  db: DB,
  userId: string,
  docId: string,
  cap: Capability,
): Promise<DocAccess> {
  const access = await getDocAccess(db, userId, docId);
  if (!access) throw notFound("Document not found, or you don't have access.");
  if (!can(access.role, cap)) {
    throw forbidden(
      access.role === "viewer"
        ? "You have view-only access to this document."
        : "Only the owner can do that.",
    );
  }
  return access;
}
