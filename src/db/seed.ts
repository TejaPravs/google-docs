/**
 * Seeds demo users, documents and shares. Idempotent: safe to run repeatedly.
 *   npm run db:seed            -> insert anything missing
 *   npm run db:seed -- --reset -> wipe all data first, then seed
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { documents, documentShares, users, type TiptapDoc } from "./schema";
import { docToText } from "../lib/tiptap-text";

const t = (text: string, marks?: string[]) => ({
  type: "text",
  text,
  ...(marks ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: object[]) => ({ type: "paragraph", content });
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [t(text)] });
const li = (...content: object[]) => ({ type: "listItem", content: [p(...content)] });
const ul = (...items: object[]) => ({ type: "bulletList", content: items });
const ol = (...items: object[]) => ({ type: "orderedList", attrs: { start: 1 }, content: items });
const doc = (...content: object[]): TiptapDoc => ({ type: "doc", content });

const SEED_USERS = [
  { email: "alice@ajaia.dev", name: "Alice Owner", avatarColor: "#4f46e5" },
  { email: "bob@ajaia.dev", name: "Bob Editor", avatarColor: "#16a34a" },
  { email: "carol@ajaia.dev", name: "Carol Viewer", avatarColor: "#d97706" },
] as const;

type SeedDoc = {
  owner: string;
  title: string;
  content: TiptapDoc;
  shares: { email: string; role: "viewer" | "editor" }[];
};

const SEED_DOCS: SeedDoc[] = [
  {
    owner: "alice@ajaia.dev",
    title: "Welcome to Ajaia Docs",
    shares: [],
    content: doc(
      h(1, "Welcome to Ajaia Docs"),
      p(t("A lightweight editor for shared work. Everything you type "), t("autosaves", ["bold"]), t(".")),
      h(2, "Formatting"),
      ul(
        li(t("Bold", ["bold"]), t(" — Ctrl/Cmd + B")),
        li(t("Italic", ["italic"]), t(" — Ctrl/Cmd + I")),
        li(t("Underline", ["underline"]), t(" — Ctrl/Cmd + U")),
      ),
      h(2, "Try it"),
      ol(
        li(t("Create a new document from the dashboard")),
        li(t("Import a .txt, .md or .docx file")),
        li(t("Share it with Bob or Carol")),
      ),
    ),
  },
  {
    owner: "alice@ajaia.dev",
    title: "Q4 Planning",
    shares: [
      { email: "bob@ajaia.dev", role: "editor" },
      { email: "carol@ajaia.dev", role: "viewer" },
    ],
    content: doc(
      h(1, "Q4 Planning"),
      h(2, "Goals"),
      ul(li(t("Ship the Ajaia Docs MVP")), li(t("Reduce", ["bold"]), t(" onboarding time by 30%"))),
      h(2, "Milestones"),
      ol(li(t("Draft")), li(t("Review")), li(t("Launch"))),
      p(t("Bob can edit this doc; Carol can only view it.", ["italic"])),
    ),
  },
  {
    owner: "alice@ajaia.dev",
    title: "Private notes",
    shares: [],
    content: doc(h(2, "Ideas"), p(t("Only Alice can see this document."))),
  },
  {
    owner: "bob@ajaia.dev",
    title: "Bob's ideas",
    shares: [{ email: "alice@ajaia.dev", role: "viewer" }],
    content: doc(
      h(1, "Bob's ideas"),
      ul(li(t("Comments on documents")), li(t("Version history")), li(t("Export to Markdown"))),
    ),
  },
];

async function main() {
  const db = getDb();
  const reset = process.argv.includes("--reset");

  if (reset) {
    await db.execute(sql`truncate table document_shares, documents, users cascade`);
    console.log("Reset: all data removed.");
  }

  await db.insert(users).values([...SEED_USERS]).onConflictDoNothing({ target: users.email });
  const allUsers = await db.select().from(users);
  const idByEmail = new Map(allUsers.map((u) => [u.email, u.id]));

  let createdDocs = 0;
  let createdShares = 0;
  for (const d of SEED_DOCS) {
    const ownerId = idByEmail.get(d.owner)!;
    let [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.ownerId, ownerId), eq(documents.title, d.title)))
      .limit(1);
    if (!existing) {
      [existing] = await db
        .insert(documents)
        .values({ ownerId, title: d.title, content: d.content, contentText: docToText(d.content) })
        .returning({ id: documents.id });
      createdDocs++;
    }
    for (const s of d.shares) {
      const res = await db
        .insert(documentShares)
        .values({ documentId: existing.id, userId: idByEmail.get(s.email)!, role: s.role, grantedBy: ownerId })
        .onConflictDoNothing()
        .returning({ documentId: documentShares.documentId });
      createdShares += res.length;
    }
  }

  console.log(
    `Seed complete: ${allUsers.length} users, ${createdDocs} new documents, ${createdShares} new shares.`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
