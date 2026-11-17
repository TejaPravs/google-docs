# AI workflow note

## Tools used

- **Claude Code** (Claude desktop app) as a pair programmer: design docs, scaffolding, implementation, running tests and driving a browser to check the UI.
- **Neon CLI** (`neon init`) to link the database and pull connection strings without pasting secrets by hand.
- Everything else is standard tooling: Vitest, ESLint, `tsc`, Drizzle Kit, Vercel CLI.

## Where AI materially sped things up

- **Design before code.** In the first ~20 minutes I had a PRD, HLD, LLD (schema, API contract, autosave state machine) and a UI/UX spec with wireframes ([`docs/`](docs/)). Writing those by hand would have taken most of an hour. With them in place, every later step was "implement section X".
- **Boilerplate with intent.** Route handlers, Zod schemas, the error-to-HTTP mapping, the Drizzle schema and seed, and the toolbar/dialog components came out consistent on the first pass because they followed the LLD.
- **Test scaffolding.** The PGlite harness (real Postgres + real migrations, in-process) and 65 tests, including fixtures such as a real `.docx` generated with JSZip.
- **Verification loops.** The assistant ran the app in a browser pane and checked the DOM and screenshots after each milestone, which caught the bugs listed below.

## What I changed or rejected

- **Framework version.** The scaffold came out on Next.js 16. I asked for **Next.js 14**, so it was downgraded (React 18, `.mjs` config, ESLint 8, synchronous `params`) and the docs were updated to match.
- **Auth.** After linking Neon, a managed auth product was available. I kept the **mocked seeded-user login** from the PRD because the brief allows it and it makes review instant. The session module stays the single place to swap.
- **Database safety.** When another process replaced my database schema mid-build, the assistant **stopped and asked** instead of re-migrating over someone else's work. I made the call to re-migrate.
- **A wrong test expectation.** One AI-written test asserted that inline HTML text in Markdown is removed. The code correctly removes the *tags* but keeps the *words*. I kept the code and rewrote the test, because keeping a reader's words is the right product behaviour.
- **Unverified claims.** Markdown-style typing shortcuts (`# `, `- `) couldn't be confirmed by browser automation, so they're documented as such rather than claimed.
- **Scope.** I asked for UX fixes that weren't in the plan: renames must show on the dashboard immediately, and logout must truly end the session (now a menu with *Switch user* and *Log out*).

## How I verified correctness, UX and reliability

- **Every milestone was exercised end to end**, not just compiled: curl scripts for each API rule (401/403/404/409/413/415 paths) and browser runs for each flow (create → format → rename → reload; share → switch user → view-only; import; conflict in two tabs; logout → back button).
- **Tests that can fail.** I planted 6 real bugs (for example "viewer can edit", "no version check", "retry a possibly-sent write"). The suite caught each one, and one gap found this way led to a new test.
- **Bugs caught by verification, not by the first draft:**
  - Next 14's `fetch` cache served stale database reads.
  - The client router cache showed old titles.
  - Sessions went stale after a re-seed.
  - The `.docx` underline was dropped.
  - A dev-server hot-reload corruption looked like an app bug.
- **Reliability decisions with tests behind them:** retry only on connect-phase network errors, so no double writes; optimistic locking, so no lost edits; server-side authorization with a 404 for outsiders.
- **Secrets handling:** `.env` is git-ignored and excluded from Vercel uploads, and connection strings were never printed in logs or chat output.

> I reviewed and edited this note. The judgment calls above (framework version, auth approach, the re-migration and the UX requirements) were mine.
