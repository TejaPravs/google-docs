import { describe, expect, it, vi } from "vitest";
import { shareSchema, updateDocSchema } from "@/lib/validation";
import { docToText } from "@/lib/tiptap-text";
import { fetchWithConnectRetry } from "@/db/client";

describe("validation", () => {
  it("rejects blank or overlong titles and empty updates", () => {
    expect(updateDocSchema.safeParse({ title: "   ", version: 1 }).success).toBe(false);
    expect(updateDocSchema.safeParse({ title: "a".repeat(201), version: 1 }).success).toBe(false);
    expect(updateDocSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateDocSchema.safeParse({ title: "ok" }).success).toBe(false); // version required
  });

  it("trims titles and accepts valid updates", () => {
    const r = updateDocSchema.parse({ title: "  Plan  ", version: 3 });
    expect(r.title).toBe("Plan");
  });

  it("rejects content that isn't a Tiptap doc", () => {
    expect(updateDocSchema.safeParse({ content: { type: "html" }, version: 1 }).success).toBe(false);
  });

  it("normalises share emails and only allows viewer/editor", () => {
    expect(shareSchema.parse({ email: "  Bob@Ajaia.DEV ", role: "editor" }).email).toBe("bob@ajaia.dev");
    expect(shareSchema.safeParse({ email: "bob@ajaia.dev", role: "owner" }).success).toBe(false);
    expect(shareSchema.safeParse({ email: "not-an-email", role: "viewer" }).success).toBe(false);
  });
});

describe("docToText", () => {
  it("flattens headings, paragraphs, lists and line breaks", () => {
    const text = docToText({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
          ],
        },
      ],
    });
    expect(text).toBe("Title\na\nb\none\n\ntwo");
  });
});

describe("fetchWithConnectRetry (Neon transport)", () => {
  const connectTimeout = () =>
    Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });

  it("retries when the connection was never made, then succeeds", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(connectTimeout())
      .mockResolvedValueOnce(new Response("ok"));
    const res = await fetchWithConnectRetry("https://x", {}, f);
    expect(await res.text()).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry errors after the request may have been sent (no double writes)", async () => {
    const reset = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    const f = vi.fn<typeof fetch>().mockRejectedValue(reset);
    await expect(fetchWithConnectRetry("https://x", {}, f)).rejects.toBe(reset);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
