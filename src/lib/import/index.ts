import { generateJSON } from "@tiptap/html/server";
import { Marked } from "marked";
import mammoth from "mammoth";
import type { TiptapDoc } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { baseExtensions } from "@/lib/editor-extensions";
import { docToText } from "@/lib/tiptap-text";

/**
 * File import: .txt / .md / .docx -> a new editable document.
 * Everything is parsed in memory; the original file is not stored.
 * HTML is converted with the SAME schema as the editor, so anything the editor
 * can't represent (scripts, iframes, styles, images, tables…) is dropped.
 */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_EXTENSIONS = [".txt", ".md", ".markdown", ".docx"] as const;
export type ImportKind = "txt" | "md" | "docx";

export type ImportResult = {
  title: string;
  content: TiptapDoc;
  contentText: string;
  notes: string[]; // user-facing caveats, e.g. "Images were skipped."
};

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" — .docx is a zip

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

export function detectKind(filename: string, bytes: Uint8Array): ImportKind {
  const ext = extensionOf(filename);
  const unsupported = () =>
    new AppError(
      "UNSUPPORTED_FILE",
      415,
      `Can't import “${filename}”. Supported types: .txt, .md, .docx.`,
    );

  if (ext === ".docx") {
    if (!ZIP_MAGIC.every((b, i) => bytes[i] === b)) {
      throw new AppError("UNSUPPORTED_FILE", 415, `“${filename}” isn't a valid .docx file.`);
    }
    return "docx";
  }
  if (ext === ".txt" || ext === ".md" || ext === ".markdown") {
    // Text files must not contain NUL bytes (rules out renamed binaries).
    if (bytes.includes(0)) throw unsupported();
    return ext === ".txt" ? "txt" : "md";
  }
  throw unsupported();
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, "");
  const ext = extensionOf(base);
  const name = (ext ? base.slice(0, -ext.length) : base).replace(/[_]+/g, " ").trim();
  return (name || "Imported document").slice(0, 200);
}

/** Plain text: blank lines separate paragraphs; single newlines become line breaks. */
export function txtToDoc(text: string): TiptapDoc {
  const paragraphs = text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/, ""))
    .filter((p) => p.trim().length > 0);

  return {
    type: "doc",
    content: paragraphs.map((p) => {
      const lines = p.split("\n");
      const content: object[] = [];
      lines.forEach((line, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        if (line) content.push({ type: "text", text: line });
      });
      return { type: "paragraph", content };
    }),
  };
}

// Markdown: raw HTML blocks/inline HTML are dropped entirely (not just escaped).
const markdown = new Marked({ gfm: true, breaks: false, async: false });
markdown.use({ renderer: { html: () => "" } });

export function mdToDoc(text: string): TiptapDoc {
  const html = markdown.parse(text.replace(/^﻿/, "")) as string;
  return htmlToDoc(html);
}

export function htmlToDoc(html: string): TiptapDoc {
  // Defense in depth: strip executable/embedded elements before parsing.
  const cleaned = html.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "");
  return trimEmptyBlocks(generateJSON(cleaned, baseExtensions) as TiptapDoc);
}

/** Drop empty paragraphs at the start/end (left behind by skipped images etc.). */
function trimEmptyBlocks(doc: TiptapDoc): TiptapDoc {
  const blocks = [...((doc.content ?? []) as { type: string; content?: unknown[] }[])];
  const isEmpty = (b: { type: string; content?: unknown[] }) => b.type === "paragraph" && !b.content?.length;
  while (blocks.length && isEmpty(blocks[0])) blocks.shift();
  while (blocks.length && isEmpty(blocks[blocks.length - 1])) blocks.pop();
  return { ...doc, content: blocks };
}

/** UTF-8 first; fall back to Windows-1252 (older Windows editors) instead of rejecting. */
export function decodeText(bytes: Uint8Array): { text: string; legacyEncoding: boolean } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), legacyEncoding: false };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), legacyEncoding: true };
  }
}

export async function docxToDoc(bytes: Uint8Array): Promise<{ doc: TiptapDoc; notes: string[] }> {
  let html: string;
  try {
    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      { styleMap: ["u => u"] }, // mammoth drops underline unless mapped explicitly
    );
    html = result.value;
  } catch {
    throw new AppError("UNSUPPORTED_FILE", 415, "This .docx file couldn't be read. It may be corrupted.");
  }
  const notes: string[] = [];
  if (/<img\b/i.test(html)) notes.push("Images aren't supported and were skipped.");
  if (/<table\b/i.test(html)) notes.push("Tables were converted to plain paragraphs.");
  return { doc: htmlToDoc(html), notes };
}

export async function importFile(file: { name: string; bytes: Uint8Array }): Promise<ImportResult> {
  if (file.bytes.byteLength === 0) {
    throw new AppError("EMPTY_FILE", 422, `“${file.name}” is empty.`);
  }
  if (file.bytes.byteLength > IMPORT_MAX_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      413,
      `“${file.name}” is ${(file.bytes.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`,
    );
  }

  const kind = detectKind(file.name, file.bytes);
  let content: TiptapDoc;
  let notes: string[] = [];
  if (kind === "docx") {
    ({ doc: content, notes } = await docxToDoc(file.bytes));
  } else {
    const { text, legacyEncoding } = decodeText(file.bytes);
    if (legacyEncoding) notes.push("The file wasn't UTF-8, so it was read as Windows-1252 text.");
    content = kind === "md" ? mdToDoc(text) : txtToDoc(text);
  }

  const contentText = docToText(content);
  if (!contentText.trim()) {
    throw new AppError("EMPTY_FILE", 422, `“${file.name}” doesn't contain any text to import.`);
  }
  return { title: titleFromFilename(file.name), content, contentText, notes };
}
