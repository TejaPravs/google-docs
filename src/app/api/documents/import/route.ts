import { AppError, handler } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { IMPORT_MAX_BYTES, importFile } from "@/lib/import";
import { createDocument } from "@/services/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // mammoth + happy-dom need Node APIs

/** POST /api/documents/import (multipart, field "file") — .txt/.md/.docx -> new document. */
export const POST = handler(async (req) => {
  const user = await requireUser();

  // Reject oversized uploads before reading the body (+64 KB for multipart overhead).
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > IMPORT_MAX_BYTES + 64 * 1024) {
    throw new AppError("FILE_TOO_LARGE", 413, "That file is larger than the 2 MB limit.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError("VALIDATION", 400, "Upload a file using the “file” field.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new AppError("VALIDATION", 400, "Choose a file to import.");
  }

  const result = await importFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  const doc = await createDocument(user.id, { title: result.title, content: result.content });

  return Response.json({ id: doc.id, title: doc.title, notes: result.notes }, { status: 201 });
});
