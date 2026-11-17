import { handler } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createDocSchema } from "@/lib/validation";
import { createDocument, listForUser } from "@/services/documents";

export const dynamic = "force-dynamic";

/** GET /api/documents — { owned, shared } for the signed-in user. */
export const GET = handler(async () => {
  const user = await requireUser();
  return Response.json(await listForUser(user.id));
});

/** POST /api/documents {title?} — create a new (empty) document. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const text = await req.text();
  const input = createDocSchema.parse(text ? JSON.parse(text) : {});
  const doc = await createDocument(user.id, input);
  return Response.json(
    { id: doc.id, title: doc.title, version: doc.version, updatedAt: doc.updatedAt },
    { status: 201 },
  );
});
