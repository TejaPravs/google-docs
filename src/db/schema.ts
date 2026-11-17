import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  jsonb,
  integer,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/** Tiptap/ProseMirror document JSON. Validated with zod at the API boundary. */
export type TiptapDoc = { type: "doc"; content?: unknown[] };

export const EMPTY_DOC: TiptapDoc = { type: "doc", content: [{ type: "paragraph" }] };

export const shareRole = pgEnum("share_role", ["viewer", "editor"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull().default("Untitled document"),
    content: jsonb("content").$type<TiptapDoc>().notNull().default(EMPTY_DOC),
    /** Plain-text projection of `content`, computed server-side. Used for previews/search. */
    contentText: text("content_text").notNull().default(""),
    /** Optimistic-concurrency counter; bumped on every write. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_owner_updated_idx").on(t.ownerId, t.updatedAt)],
);

export const documentShares = pgTable(
  "document_shares",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: shareRole("role").notNull().default("viewer"),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index("document_shares_user_idx").on(t.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentShare = typeof documentShares.$inferSelect;
export type ShareRole = (typeof shareRole.enumValues)[number];
export type AccessRole = "owner" | ShareRole;
