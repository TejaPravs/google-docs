# Submission: Ajaia Docs

**Candidate:** Teja Pravallika Nandamuri

| | |
|---|---|
| **Live app** | **https://ajaia-docs-two-ochre.vercel.app** |
| **Walkthrough video** | see [`VIDEO_URL.txt`](VIDEO_URL.txt) |
| **Demo accounts** | `alice@ajaia.dev` (owner), `bob@ajaia.dev` (editor on “Q4 Planning”), `carol@ajaia.dev` (viewer on “Q4 Planning”). No passwords: pick a user on the sign-in page. |

## What's included

| Item | Location |
|---|---|
| Source code | this folder (`src/`, `drizzle/`, `tests/`, `scripts/`) |
| Setup and run instructions | [`README.md`](README.md) |
| Architecture note | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| AI workflow note | [`AI_WORKFLOW.md`](AI_WORKFLOW.md) |
| Design docs (PRD, HLD, LLD, UI/UX, build plan) | [`docs/`](docs/) |
| Automated tests (65) | [`tests/`](tests/), run with `npm test` |
| Sample import files | [`tests/fixtures/`](tests/fixtures/): `sample.md`, `sample.txt`, `sample.docx` |
| Video link | [`VIDEO_URL.txt`](VIDEO_URL.txt) |
| Screenshots | [`screenshots/`](screenshots/) |
| Env template (no secrets) | [`.env.example`](.env.example) |

## What is working (end to end, on the live URL)

- Sign in as a seeded user; switch user and log out from the account menu.
- Dashboard with **My documents** and **Shared with me** (owner name, role badge, share count, last edited).
- Create, rename, edit with rich text (H1–H3, bold, italic, underline, bulleted and numbered lists, undo/redo), autosave, reopen with formatting intact, delete (owner).
- **Import** `.txt`, `.md` or `.docx` (≤ 2 MB) as a new document, with structure preserved and clear errors for anything else.
- **Sharing:** the owner adds people by email as Editor or Viewer, changes roles and revokes access. Viewers get a read-only editor; non-owners see a read-only access list.
- **Server-enforced permissions** and **conflict detection** (a 409 with a recovery banner instead of silent overwrites).
- 65 automated tests (unit + PGlite integration), typecheck and lint all pass.

## What is incomplete or simplified

- **Auth is mocked** (pick a seeded user). There are no passwords or sign-up; the session layer is isolated so real auth can be dropped in.
- **No real-time co-editing.** Concurrent edits are detected and blocked rather than merged; the other person must reload.
- **Import:** images are skipped (the user is told) and tables are flattened to paragraphs. `.docx` numbered lists may import as bullets depending on the source file's numbering definitions.
- **No drag-and-drop import** (button only).
- Markdown-style typing shortcuts (`# `, `- `) come from Tiptap defaults and were not verified by automated browser tests.

## What I'd build next with 2–4 more hours

1. **Version history** (about 1.5h): snapshot on every Nth save into a `document_versions` table, with list and restore. It builds on the existing `version` column.
2. **Export to Markdown / PDF** (about 30–45 min): a server-side JSON-to-Markdown serializer and a download button.
3. **Comments on a selection** (about 1.5h): an anchored comment mark plus a side panel, with the same access rules (viewers can comment).
4. **Playwright smoke test in CI**: login → create → format → reload → share, run on every push.
5. **Real auth** (Auth.js or Neon Auth) replacing the demo picker, keeping the same `getSession()` contract.
