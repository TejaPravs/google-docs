# Ajaia Docs

A lightweight collaborative document editor: create, format, import and share documents, with autosave and conflict-safe editing.

**Live demo:** **https://ajaia-docs-two-ochre.vercel.app** · **Stack:** Next.js 14 (App Router) · TypeScript · Tiptap · Drizzle ORM · Neon Postgres · Vercel

## Try it in 2 minutes (no setup)

Open the live URL and pick a demo user. There are no passwords.

| User | Email | What to try |
|---|---|---|
| **Alice Owner** | `alice@ajaia.dev` | Owns the sample docs. Create, import, share, delete. |
| **Bob Editor** | `bob@ajaia.dev` | Can **edit** “Q4 Planning” (shared by Alice). |
| **Carol Viewer** | `carol@ajaia.dev` | Can only **view** “Q4 Planning”. |

To see sharing from both sides at once, sign in as Alice in a normal window and as Bob or Carol in a private window. Use **Account menu → Switch user** to change user in the same window.

Suggested path:
1. **Alice:** click **New document**, type with the toolbar (H1–H3, **B** / *I* / U, bullets, numbers), rename it from the title, then reload. Everything persists.
2. **Alice:** click **Import file** and pick a `.md`, `.txt` or `.docx` file. The sample files in `tests/fixtures/` work.
3. **Alice:** click **Share**, enter `carol@ajaia.dev` as Viewer, then switch to Carol. The doc appears under **Shared with me** and is read-only.
4. **Conflict safety:** open the same doc in two tabs, edit in one and then the other. The stale tab shows *“changed somewhere else”* instead of overwriting.

## Features

| Area | What works |
|---|---|
| Documents | Create, rename (inline title), edit, autosave (about 1s debounce, retry with backoff, warning on unsaved close), reopen, delete (owner, with confirm) |
| Editor | Bold, italic, underline, Heading 1–3, bulleted and numbered lists, undo/redo, keyboard shortcuts, ⌘/Ctrl+S |
| Import | `.txt`, `.md`, `.docx` up to **2 MB** become a **new document** with structure preserved. Images are dropped (the user is told), tables are flattened, unsafe HTML is stripped. |
| Sharing | Owner shares by email as **Editor** or **Viewer**, changes roles, revokes access. The dashboard separates **My documents** from **Shared with me** (owner name + role badge). |
| Access control | Enforced on the server for every request. Viewers can't edit, non-owners can't share or delete, and outsiders get a 404 (the doc's existence isn't revealed). |
| Persistence | Postgres (Neon). Content is stored as Tiptap JSON (`jsonb`), so formatting round-trips exactly. |
| Concurrency | Optimistic locking with a `version` column. Stale saves get **409** plus a "Reload latest / Copy my text" banner, so edits are never silently lost. |

Supported import types are stated in the UI next to the Import button and above.

## Run locally

Requirements: Node 20+ and a free [Neon](https://neon.tech) Postgres database.

```bash
git clone <repo-url> ajaia-docs && cd ajaia-docs
npm install
cp .env.example .env        # then fill in the values (see below)
npm run db:migrate          # create tables
npm run db:seed             # demo users + sample docs (idempotent)
npm run dev                 # http://localhost:3000
```

`.env`:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (used by the app) |
| `DATABASE_URL_UNPOOLED` | recommended | Neon **direct** connection string (used by `drizzle-kit` for migrations) |
| `SESSION_SECRET` | yes | 32+ random characters; signs the session cookie. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

Alternatively, `npm run env:db` prompts for the URL with hidden input and writes it to `.env`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve |
| `npm test` | 65 unit + integration tests (Vitest + in-memory Postgres, no network needed) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle migrations / inspect the DB |
| `npm run db:seed` (`-- --reset` to wipe first) | Seed demo data |

## Tests

```bash
npm test
```

- **Integration** (`tests/*.service.test.ts`): the real services run against **PGlite**, an in-process Postgres, with the **same migration** used on Neon. They cover the access matrix on shared docs, 409 conflicts, owned-vs-shared listing, share/role/revoke flows and cascade deletes.
- **Unit:** import of real `.md` / `.txt` / `.docx` fixtures (structure, marks, XSS stripping, 7 rejection cases), validation, plain-text extraction, and the network retry (it never re-sends a possibly-delivered write).
- I checked the suite by planting 6 real bugs (for example "viewer can edit" and "no version check"). Each one made tests fail.

## Project layout

```
src/
  app/                 pages (login, dashboard, editor) + API route handlers
  components/          editor (Tiptap, toolbar, autosave), share dialog, dashboard UI
  services/            documents, shares, users: all DB access, authz enforced here
  lib/                 access (authz matrix), session (JWT cookie), validation (zod), import, errors
  db/                  Drizzle schema, Neon client, seed
drizzle/               SQL migrations (committed)
tests/                 Vitest suites + fixtures
docs/                  PRD, HLD, LLD, UI/UX spec, build plan
```

More: [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_WORKFLOW.md](AI_WORKFLOW.md) · [SUBMISSION.md](SUBMISSION.md) · [docs/](docs/)
