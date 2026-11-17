# PRD — "Ajaia Docs": Lightweight Collaborative Document Editor

| Field | Value |
|---|---|
| Owner | Teja Pravallika Nandamuri |
| Status | Approved for build |
| Stack | Next.js 14 (App Router, TypeScript) · Drizzle ORM · Neon Postgres · Tiptap editor · Vercel |
| Timebox | 4–6 hours total (build + docs + video) |

---

## 1. Problem & Goal

Ajaia teams need a fast internal place to **write, import, and share working documents** without the weight of a full office suite. The goal of this slice is not Google Docs parity — it is a **coherent, reliable, end-to-end loop**:

> Sign in → create or import a doc → write with basic formatting → it autosaves → share it with a teammate → teammate sees it under "Shared with me" and can open (and, if allowed, edit) it.

Success = a reviewer can complete that loop on the live URL in under 3 minutes with zero setup.

## 2. Users & Personas

| Persona | Need |
|---|---|
| **Author (Owner)** | Create docs quickly, format them, import existing notes, control who sees them. |
| **Collaborator (Editor)** | Open a doc shared with them and contribute edits. |
| **Reader (Viewer)** | Read a shared doc without risk of changing it. |
| **Reviewer (Ajaia evaluator)** | Test every flow in minutes using seeded accounts. |

Seeded demo accounts (mocked auth, no passwords to manage):

| Name | Email | Purpose |
|---|---|---|
| Alice Owner | `alice@ajaia.dev` | Owns sample docs, shares them |
| Bob Editor | `bob@ajaia.dev` | Has editor access to one of Alice's docs |
| Carol Viewer | `carol@ajaia.dev` | Has viewer access to one of Alice's docs |

## 3. Scope

### 3.1 In scope (MVP — must ship)

| # | Capability | Requirement |
|---|---|---|
| F1 | **Auth (mocked)** | Pick a seeded user on `/login` → signed, httpOnly session cookie. Logout. |
| F2 | **Document list** | Dashboard with two clearly separated sections: **My documents** and **Shared with me** (with owner name + role badge). Sorted by last updated. |
| F3 | **Create** | "New document" creates an "Untitled document" and opens the editor. |
| F4 | **Rename** | Inline-editable title in the editor header; saved on blur/Enter. 1–200 chars. |
| F5 | **Rich-text editing** | Bold, Italic, Underline, H1/H2/H3, Bulleted list, Numbered list, Undo/Redo. Toolbar + keyboard shortcuts. |
| F6 | **Autosave + reopen** | Debounced autosave (~1s after typing stops). Visible status: *Saving… / Saved / Offline – retrying / Conflict*. Content stored as structured JSON → formatting survives refresh. |
| F7 | **File import** | Upload `.txt`, `.md`, or `.docx` (≤ 2 MB) → becomes a **new editable document** with structure preserved (headings, lists, bold/italic). Supported types stated in UI and README. |
| F8 | **Sharing** | Owner shares by email with role **Viewer** or **Editor**; can change role or revoke. Shared users see it under "Shared with me". |
| F9 | **Access enforcement** | Server enforces: owner = full; editor = read + edit content/title; viewer = read-only (editor renders non-editable). No access → 404 (don't leak existence). |
| F10 | **Delete** | Owner can delete a doc (confirm dialog). |
| F11 | **Quality** | Zod validation on every input, typed errors, toasts, automated tests, README, architecture + AI notes, live Vercel URL. |

### 3.2 Stretch (only if MVP is done, pick in order)

1. **Role-based permissions (Viewer/Editor)** — *planned into MVP because it is cheap and deepens the sharing story.*
2. **Export to Markdown** (download button) — ~30 min.
3. **Version history** (snapshot on every Nth save, list + restore) — ~1.5 h, likely deferred.

### 3.3 Explicitly out of scope (deliberate cuts)

| Cut | Why |
|---|---|
| Real-time co-editing (CRDT/Yjs, cursors) | Requires websockets infra + conflict model; huge risk for a 4–6h box. Replaced with **optimistic-concurrency conflict detection** so concurrent edits never silently overwrite. |
| Real auth (passwords, OAuth, email verify) | Not what's being evaluated; seeded users make review instant. Session layer is isolated so real auth can be swapped in. |
| Comments / suggestions | Stretch-only in brief; deprioritized for depth on core. |
| Storing original uploaded files | Import parses in memory → no blob storage cost/config on Vercel. |
| Images, tables, links, fonts, colors | Beyond required formatting set. |
| Folders, search, trash/restore | Nice-to-have; list is small in demo. |
| Public link sharing | Increases access-control surface; user-to-user sharing is the requirement. |

## 4. User Stories & Acceptance Criteria

**US-1 Sign in** — As a reviewer, I can choose Alice/Bob/Carol and land on my dashboard.
- AC: Session persists across refresh; `/docs/*` and `/api/*` (except login) return redirect/401 without a session.

**US-2 Create & edit** — As an author, I create a doc, type formatted text, refresh, and everything is still there.
- AC: Bold/italic/underline/H1–H3/bullets/numbers render identically after reload.
- AC: Status shows "Saved" within ~2s of stopping typing.

**US-3 Rename** — As an author, I click the title, type a new name, press Enter.
- AC: Empty title rejected (reverts + toast); new title appears on dashboard.

**US-4 Import** — As an author, I upload `notes.md` / `brief.docx` / `todo.txt`.
- AC: A new doc titled after the file name opens with headings/lists preserved.
- AC: `.pdf`, files > 2 MB, or empty files show a clear error; nothing is created.

**US-5 Share** — As Alice, I share a doc with `bob@ajaia.dev` as Editor.
- AC: Unknown email → "No user with that email". Sharing with self → rejected. Duplicate → role updated.
- AC: Bob (after switching user) sees it in "Shared with me" with "Editor · from Alice Owner".

**US-6 Roles** — As Carol (Viewer), I open a shared doc.
- AC: Toolbar hidden/disabled, banner "View only", no autosave calls; API rejects PATCH with 403.

**US-7 Conflict safety** — If Alice and Bob edit the same doc in two tabs, the later stale save is rejected (409) and the user is prompted to reload, instead of silently clobbering.

**US-8 Revoke** — Alice removes Bob → Bob's next load returns "not found / no access".

## 5. Non-Functional Requirements

| Area | Target |
|---|---|
| Performance | Dashboard TTFB < 500ms on Neon free tier; autosave payload < 200 KB typical. |
| Reliability | No lost writes: debounce + flush on `beforeunload`/route change; retry with backoff on network error. |
| Security | All authz checks server-side in one module; signed httpOnly cookie; Zod on all inputs; upload type + size + magic-byte checks; HTML from imports sanitized via schema (Tiptap only keeps allowed nodes). |
| Accessibility | Keyboard-reachable toolbar with `aria-pressed`, labelled buttons, visible focus, WCAG AA contrast. |
| Cost | $0: Vercel Hobby + Neon free tier. Reviewers install nothing. |
| Portability | `DATABASE_URL` is the only required secret besides `SESSION_SECRET`. |

## 6. Success Metrics (for this exercise)

- All 8 user stories pass manually on the deployed URL.
- Automated tests green in CI/local (`npm test`).
- Reviewer can run locally in ≤ 5 commands.

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tiptap SSR hydration errors in Next.js | Editor is a client component with `immediatelyRender: false`. |
| `.docx` parsing edge cases | Use `mammoth` (docx → semantic HTML); unsupported constructs dropped gracefully; show "imported with simplified formatting" note. |
| Neon cold start latency | Use `@neondatabase/serverless` HTTP driver (no pool warmup); show skeleton loaders. |
| Lost edits on concurrent writers | `version` column + conditional UPDATE → 409 conflict UX. |
| Time overrun | Milestone plan (see `05-BUILD-PLAN.md`); stretch only after M5 is green and deployed. |

## 8. Deliverables Checklist (maps to assignment)

- [ ] Source code (GitHub + Drive zip)
- [ ] `README.md` — setup, env, run, test, seeded users
- [ ] `ARCHITECTURE.md` — condensed from HLD/LLD: what was prioritized and why
- [ ] `AI_WORKFLOW.md` — tools, speedups, rejected output, verification
- [ ] `SUBMISSION.md` — exact inventory, what works / incomplete / next 2–4h
- [ ] Live URL (Vercel)
- [ ] `VIDEO_URL.txt` — 3–5 min Loom
- [ ] `screenshots/` — dashboard, editor, share dialog, viewer mode
