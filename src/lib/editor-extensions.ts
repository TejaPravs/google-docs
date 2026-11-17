import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/react";

/**
 * The document schema. Shared by the browser editor and server-side import
 * (M6) so both produce/accept exactly the same node + mark types — anything
 * outside this list (scripts, images, tables…) is dropped by the schema.
 */
export const baseExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
    code: false,
    horizontalRule: false,
    link: false,
  }),
];
