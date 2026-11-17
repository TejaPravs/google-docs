import { handler } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { updateDocSchema } from "@/lib/validation";
import { deleteDocument, getDocument, updateDocument } from "@/services/documents";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/documents/:id — document + caller's role. 404 if no access. */
export const GET = handler<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { doc, role, owner } = await getDocument(user.id, params.id);
  return Response.json({ doc, role, owner });
});

/** PATCH /api/documents/:id {title?, content?, version} — 409 if version is stale. */
export const PATCH = handler<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const input = updateDocSchema.parse(await req.json());
  return Response.json(await updateDocument(user.id, params.id, input));
});

/** DELETE /api/documents/:id — owner only. */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  await deleteDocument(user.id, params.id);
  return new Response(null, { status: 204 });
});
