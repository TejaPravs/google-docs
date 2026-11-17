import { handler } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { shareSchema } from "@/lib/validation";
import { listShares, shareDocument } from "@/services/shares";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/documents/:id/shares — owner + people with access (any reader). */
export const GET = handler<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  return Response.json(await listShares(user.id, params.id));
});

/** POST /api/documents/:id/shares {email, role} — owner shares or changes a role. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const input = shareSchema.parse(await req.json());
  const { created, ...share } = await shareDocument(user.id, params.id, input);
  return Response.json({ ...share, created }, { status: created ? 201 : 200 });
});
