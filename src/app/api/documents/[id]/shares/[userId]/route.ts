import { handler } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { revokeShare } from "@/services/shares";

export const dynamic = "force-dynamic";

/** DELETE /api/documents/:id/shares/:userId — owner revokes someone's access. */
export const DELETE = handler<{ params: { id: string; userId: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  await revokeShare(user.id, params.id, params.userId);
  return new Response(null, { status: 204 });
});
