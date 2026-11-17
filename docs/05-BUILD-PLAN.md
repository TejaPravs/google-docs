# Build Plan (time-boxed, ~3h45m remaining)

Rule: **deploy early (M1), deploy often.** Stretch work only starts after M6 is green on the live URL.

```mermaid
gantt
    dateFormat HH:mm
    axisFormat %H:%M
    title Ajaia Docs build timeline
    section Foundation
    M1 Scaffold + Neon + Drizzle + deploy   :m1, 00:00, 30m
    M2 Session auth + seed + login page     :m2, after m1, 25m
    section Core
    M3 Documents API + dashboard            :m3, after m2, 35m
    M4 Editor + toolbar + autosave/version  :m4, after m3, 45m
    M5 Sharing API + dialog + roles         :m5, after m4, 35m
    M6 Import txt/md/docx                   :m6, after m5, 25m
    section Ship
    M7 Tests                                :m7, after m6, 25m
    M8 Docs + screenshots + video           :m8, after m7, 30m
```

| Milestone | Done when |
|---|---|
| **M1** Scaffold | `create-next-app`; Neon project + `DATABASE_URL`; `schema.ts`; `db:generate` + `db:migrate`; Vercel project linked with env vars; "hello" page live. |
| **M2** Auth | `session.ts` (jose), `/login` picker, `/api/auth/*`, redirect guard on `/docs`, `seed.ts` run against Neon. |
| **M3** Docs | `access.ts`, `errors.ts`, `validation.ts`, `services/documents.ts`, `/api/documents` GET/POST, `/api/documents/[id]` GET/PATCH/DELETE, dashboard with two sections + New button. |
| **M4** Editor | Tiptap client component, toolbar (B/I/U, H1–3, lists, undo/redo), TitleInput, `useAutosave` with version + 409 banner, viewer read-only. **Redeploy.** |
| **M5** Sharing | `services/shares.ts`, share routes, ShareDialog with role select + revoke, shared cards "from {owner}". **Redeploy + test with 2 browsers.** |
| **M6** Import | `lib/import/*`, `/api/documents/import`, ImportButton with limits shown. **Redeploy.** |
| **M7** Tests | access matrix, import parsers, PGlite service integration (conflict + sharing). |
| **M8** Ship | README, ARCHITECTURE.md, AI_WORKFLOW.md, SUBMISSION.md, screenshots, Loom, `VIDEO_URL.txt`, Drive folder. |

**Cut order if behind schedule** (cut from the top): drag-and-drop import → share autocomplete → role dropdown change (keep add/revoke) → conflict "Copy my text" button → Playwright.

**Stretch if ahead:** Export to Markdown (≈30 min) → version history (≈90 min).

## Setup commands (for README)

```bash
git clone <repo> && cd ajaia-docs
```

```bash
npm install
```

```bash
cp .env.example .env   # set DATABASE_URL (Neon) and SESSION_SECRET
```

```bash
npm run db:migrate && npm run db:seed
```

```bash
npm run dev
```

`.env.example`

```
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=replace-with-32+-random-chars
```

> drizzle-kit reads `.env` via `dotenv/config`; either name the file `.env` or point dotenv at `.env.local` in `drizzle.config.ts` and `seed.ts`.
