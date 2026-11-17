import { handler } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { listUsers } from "@/services/users";

export const dynamic = "force-dynamic";

/** GET /api/users — other users, for the share dialog's email suggestions. */
export const GET = handler(async () => {
  const me = await requireUser();
  const all = await listUsers();
  return Response.json(all.filter((u) => u.id !== me.id));
});
