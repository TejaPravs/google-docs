import { notFound, redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getDb } from "@/db/client";
import { documentShares, users } from "@/db/schema";
import { getDocAccess } from "@/lib/access";
import { EditorShell } from "@/components/editor/EditorShell";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) redirect(`/login?next=/docs/${params.id}`);

  const db = getDb();
  const access = await getDocAccess(db, user.id, params.id);
  if (!access) notFound();
  const { doc, role } = access;

  const [[owner], [shares]] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, doc.ownerId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(documentShares)
      .where(eq(documentShares.documentId, doc.id)),
  ]);

  return (
    <EditorShell
      // Remount on a different doc so editor + autosave state never leak across docs.
      key={doc.id}
      doc={{
        id: doc.id,
        title: doc.title,
        content: doc.content,
        version: doc.version,
        shareCount: shares?.n ?? 0,
      }}
      role={role}
      owner={owner}
    />
  );
}
