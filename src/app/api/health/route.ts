import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

// Next 14 caches GET route handlers by default; this must hit the DB every time.
export const dynamic = "force-dynamic";

/** GET /api/health — confirms the app can reach Neon and the schema is migrated. */
export async function GET() {
  try {
    const db = getDb();
    const rows = await db.execute<{ users: number }>(
      sql`select count(*)::int as users from users`,
    );
    return Response.json({ ok: true, db: "connected", users: rows.rows[0]?.users ?? 0 });
  } catch (err) {
    console.error("[health]", err);
    return Response.json(
      { ok: false, db: "unreachable", error: err instanceof Error ? err.message : "unknown" },
      { status: 503 },
    );
  }
}
