import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importFile, titleFromFilename } from "@/lib/import";
import { AppError } from "@/lib/errors";

type Node = { type: string; attrs?: Record<string, unknown>; text?: string; marks?: { type: string }[]; content?: Node[] };

const fixture = (name: string) => ({
  name,
  bytes: new Uint8Array(readFileSync(`tests/fixtures/${name}`)),
});
const text = (s: string) => new TextEncoder().encode(s);

/** Compact outline like "heading1 paragraph bulletList" for structure assertions. */
const outline = (nodes: Node[] = []) =>
  nodes.map((n) => n.type + (n.attrs?.level ? n.attrs.level : "")).join(" ");
const allMarks = (n: Node): string[] =>
  n.type === "text" ? (n.marks ?? []).map((m) => `${m.type}:${n.text}`) : (n.content ?? []).flatMap(allMarks);

async function expectAppError(p: Promise<unknown>, code: string, status: number) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect({ code: err.code, status: err.status }).toEqual({ code, status });
}

describe("Markdown import", () => {
  it("keeps headings, inline marks, nested bullets and numbered lists", async () => {
    const r = await importFile(fixture("sample.md"));
    const nodes = r.content.content as Node[];
    expect(outline(nodes)).toBe("heading1 paragraph heading2 bulletList heading2 orderedList paragraph");
    expect(allMarks(nodes[1])).toEqual(["bold:lightweight", "italic:autosave"]);
    expect(JSON.stringify(nodes[3])).toContain('"Nested point"');
    expect(r.title).toBe("sample");
  });

  it("strips <script>, <iframe> and inline HTML (no XSS via import)", async () => {
    const r = await importFile(fixture("sample.md"));
    const json = JSON.stringify(r.content);
    expect(json).not.toMatch(/alert|evil|iframe|example\.com|onclick/i);
  });

  it("drops raw HTML blocks entirely; inline tags are removed but their words kept", async () => {
    const md = 'Intro\n\n<div class="x">hidden raw html block</div>\n\n<span style="color:red">inline</span> text';
    const r = await importFile({ name: "raw.md", bytes: text(md) });
    expect(r.contentText).toBe("Intro\ninline text");
    expect(JSON.stringify(r.content)).not.toMatch(/span|style|color/);
  });
});

describe("Plain text import", () => {
  it("blank lines split paragraphs; single newlines become line breaks (CRLF too)", async () => {
    const r = await importFile(fixture("sample.txt"));
    const nodes = r.content.content as Node[];
    expect(outline(nodes)).toBe("paragraph paragraph paragraph");
    expect(nodes[0].content?.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
    expect(r.contentText).toContain("Action: follow up.");
  });

  it("falls back to Windows-1252 for non-UTF-8 text and says so", async () => {
    const r = await importFile({ name: "old.txt", bytes: new Uint8Array([0x63, 0x61, 0x66, 0xe9]) });
    expect(r.contentText).toBe("café");
    expect(r.notes.join(" ")).toMatch(/Windows-1252/);
  });
});

describe("Word (.docx) import", () => {
  it("keeps headings, bold/italic/underline and bullet lists; reports skipped images", async () => {
    const r = await importFile(fixture("sample.docx"));
    const nodes = r.content.content as Node[];
    expect(outline(nodes)).toBe("heading1 paragraph heading2 bulletList");
    expect(allMarks(nodes[1])).toEqual(["bold:strongly", "italic:flat", "underline:Underlined note."]);
    expect(r.notes).toContain("Images aren't supported and were skipped.");
  });
});

describe("rejections", () => {
  it.each([
    ["unsupported type", { name: "report.pdf", bytes: text("%PDF-1.4") }, "UNSUPPORTED_FILE", 415],
    ["no extension", { name: "README", bytes: text("hi") }, "UNSUPPORTED_FILE", 415],
    ["binary renamed .txt", { name: "img.txt", bytes: new Uint8Array([0x89, 0x50, 0, 1]) }, "UNSUPPORTED_FILE", 415],
    ["text renamed .docx", { name: "fake.docx", bytes: text("hello") }, "UNSUPPORTED_FILE", 415],
    ["empty file", { name: "empty.txt", bytes: new Uint8Array() }, "EMPTY_FILE", 422],
    ["whitespace only", { name: "blank.md", bytes: text("  \n\n  ") }, "EMPTY_FILE", 422],
    ["over 2 MB", { name: "big.txt", bytes: new Uint8Array(2 * 1024 * 1024 + 1).fill(97) }, "FILE_TOO_LARGE", 413],
  ])("%s", async (_label, file, code, status) => {
    await expectAppError(importFile(file), code as string, status as number);
  });
});

describe("titleFromFilename", () => {
  it.each([
    ["Quarterly_Report.docx", "Quarterly Report"],
    ["notes.md", "notes"],
    ["C:\\Users\\me\\plan.txt", "plan"],
    [".md", "Imported document"],
  ])("%s -> %s", (input, expected) => {
    expect(titleFromFilename(input)).toBe(expected);
  });
});
