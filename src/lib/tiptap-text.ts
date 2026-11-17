import type { TiptapDoc } from "@/db/schema";

type Node = { type?: string; text?: string; content?: Node[] };

const BLOCKS = new Set(["paragraph", "heading", "listItem", "blockquote", "codeBlock"]);

/**
 * Plain-text projection of a Tiptap document (for previews and future search).
 * Always computed server-side from the stored JSON, never trusted from the client.
 */
export function docToText(doc: TiptapDoc): string {
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.type === "text" && node.text) out.push(node.text);
    else if (node.type === "hardBreak") out.push("\n");
    node.content?.forEach(walk);
    if (node.type && BLOCKS.has(node.type)) out.push("\n");
  };
  walk(doc as Node);
  return out
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
