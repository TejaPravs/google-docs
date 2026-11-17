import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title can't be empty.")
  .max(200, "Title must be 200 characters or fewer.");

const MAX_DOC_BYTES = 1_000_000;

export const tiptapDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.any()).optional() })
  .refine((d) => JSON.stringify(d).length <= MAX_DOC_BYTES, "Document is too large to save (max ~1 MB).");

export const loginSchema = z.object({ email: emailSchema });

export const createDocSchema = z.object({ title: titleSchema.optional() });

export const updateDocSchema = z
  .object({
    title: titleSchema.optional(),
    content: tiptapDocSchema.optional(),
    version: z.number().int().positive(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, "Nothing to update.");

export const shareSchema = z.object({
  email: emailSchema,
  role: z.enum(["viewer", "editor"], { error: "Role must be Viewer or Editor." }),
});

export const uuidSchema = z.uuid("Invalid id.");

export type UpdateDocInput = z.infer<typeof updateDocSchema>;
export type ShareInput = z.infer<typeof shareSchema>;
