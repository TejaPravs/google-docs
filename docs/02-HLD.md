# HLD — High-Level Design

## 1. Architecture at a glance

A single **Next.js 14 App Router** application deployed on **Vercel**, talking to **Neon Postgres** through **Drizzle ORM** over Neon's serverless HTTP driver. No separate backend service, no blob store, no websocket server — every moving part is free-tier and zero-config for reviewers.

```mermaid
flowchart LR
    subgraph Browser
        UI[React UI<br/>Dashboard · Editor · Share dialog]
        TT[Tiptap Editor<br/>ProseMirror JSON]
        AS[Autosave hook<br/>debounce + version]
        UI --- TT --- AS
    end

    subgraph Vercel["Vercel (Next.js runtime)"]
        RSC["Server Components<br/>pages: /login /docs /docs/:id"]
        API["Route Handlers<br/>/api/*"]
        AUTH[Session module<br/>signed JWT cookie]
        ACL[Access module<br/>getDocAccess]
        IMP[Import module<br/>txt / md / docx → JSON]
        SVC[Service layer<br/>documents · shares · users]
        DZ[Drizzle ORM]
        RSC --> AUTH
        API --> AUTH
        RSC --> SVC
        API --> SVC
        API --> IMP
        SVC --> ACL
        SVC --> DZ
    end

    DB[(Neon Postgres<br/>users · documents · document_shares)]

    UI -- "fetch JSON / multipart" --> API
    UI -- "navigation (RSC)" --> RSC
    DZ -- "HTTPS (neon-http)" --> DB
```

## 2. Key architectural decisions

| # | Decision | Alternatives considered | Rationale |
|---|---|---|---|
| D1 | **Next.js App Router monolith** (UI + API in one deploy) | Separate Express/Nest API | One repo, one deploy, one URL. Full-stack still demonstrated via explicit service/access layers. |
| D2 | **Tiptap (ProseMirror)** editor | Lexical, Slate, Quill, raw `contenteditable` | Headless, mature, StarterKit covers every required format; JSON doc model is schema-validated. |
| D3 | **Store content as Tiptap JSON (`jsonb`)** + derived `content_text` | Store HTML / Markdown | JSON is lossless for the editor schema, safe (no raw HTML injection on render), and queryable. `content_text` powers list previews and future search. |
| D4 | **Mocked auth: pick seeded user → signed httpOnly JWT cookie** (`jose`) | NextAuth, Clerk, Supabase Auth | Zero friction for reviewers, no third-party signup. `getSession()` is the single seam to swap in real auth. |
| D5 | **Authorization in one module (`lib/access.ts`)** used by every read/write | Checks sprinkled in handlers; Postgres RLS | One auditable function, unit-testable. RLS is overkill with a single DB role. |
| D6 | **Optimistic concurrency via `version` int** | Last-write-wins; CRDT/Yjs | Cheap, prevents silent data loss when two people edit — honest substitute for real-time collab. |
| D7 | **Import = parse in memory → new doc** (no file storage) | Store originals in S3/Vercel Blob | No paid/extra service; the product value is the editable doc, not the original file. |
| D8 | **Neon HTTP driver** (`drizzle-orm/neon-http`) | `pg` Pool, neon websockets | Best fit for serverless functions (no connection exhaustion, no cold pool). All writes are single statements, so no interactive transactions are needed. |
| D9 | **Route Handlers (REST) over Server Actions** for mutations | Server Actions | Explicit HTTP contract is easier to test, document, and reason about for status codes (401/403/404/409/413/415). |
| D10 | **Roles: `viewer` / `editor`** on shares | Single "has access" flag | Small cost, demonstrates real access logic; covers stretch item. |

## 3. Logical components

```mermaid
flowchart TB
    subgraph Presentation
        P1[app/login/page.tsx]
        P2[app/docs/page.tsx<br/>Dashboard]
        P3["app/docs/[id]/page.tsx<br/>Editor shell"]
        C1[components/editor/*]
        C2[components/share/*]
        C3[components/import/*]
    end
    subgraph "HTTP API"
        A1["/api/auth/*"]
        A2["/api/documents/*"]
        A3["/api/documents/import"]
        A4["/api/documents/:id/shares/*"]
    end
    subgraph Domain
        S1[services/documents.ts]
        S2[services/shares.ts]
        S3[services/users.ts]
        L1[lib/access.ts]
        L2[lib/import/*]
        L3[lib/session.ts]
        L4["lib/validation.ts (zod)"]
        L5[lib/errors.ts]
    end
    subgraph Data
        D1[db/schema.ts]
        D2[db/client.ts]
        D3[db/seed.ts]
    end
    Presentation --> A1 & A2 & A3 & A4
    P2 & P3 --> S1
    A1 --> L3 & S3
    A2 --> S1
    A3 --> L2 --> S1
    A4 --> S2
    S1 & S2 --> L1
    S1 & S2 & S3 --> D2 --> D1
    A2 & A3 & A4 --> L4 & L5
```

**Layering rule:** pages/handlers → services → db. Handlers never call Drizzle directly; services never read cookies. This keeps authz testable with plain function calls.

## 4. Data model (conceptual)

```mermaid
erDiagram
    USERS ||--o{ DOCUMENTS : owns
    USERS ||--o{ DOCUMENT_SHARES : "is granted"
    DOCUMENTS ||--o{ DOCUMENT_SHARES : "is shared via"

    USERS {
        uuid id PK
        text email UK
        text name
        text avatar_color
        timestamptz created_at
    }
    DOCUMENTS {
        uuid id PK
        uuid owner_id FK
        varchar title
        jsonb content
        text content_text
        int version
        timestamptz created_at
        timestamptz updated_at
    }
    DOCUMENT_SHARES {
        uuid document_id PK,FK
        uuid user_id PK,FK
        share_role role
        uuid granted_by FK
        timestamptz created_at
    }
```

## 5. Access model

| Action | Owner | Editor | Viewer | No access |
|---|:-:|:-:|:-:|:-:|
| See in list | ✅ My documents | ✅ Shared with me | ✅ Shared with me | — |
| Open / read | ✅ | ✅ | ✅ | 404 |
| Edit content | ✅ | ✅ | 403 | 404 |
| Rename | ✅ | ✅ | 403 | 404 |
| Manage shares | ✅ | 403 | 403 | 404 |
| Delete | ✅ | 403 | 403 | 404 |

404 (not 403) for no-access avoids confirming a document exists.

## 6. Key flows

### 6.1 Edit & autosave (with conflict protection)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant E as Tiptap + useAutosave
    participant API as PATCH /api/documents/:id
    participant ACL as access.ts
    participant DB as Neon

    U->>E: types
    E->>E: status = "Unsaved"; debounce 1000ms
    E->>API: {content, version: 7}
    API->>ACL: getDocAccess(user, id)
    ACL->>DB: SELECT doc + share
    ACL-->>API: role = owner|editor
    API->>DB: UPDATE ... SET version=8 WHERE id=? AND version=7 RETURNING
    alt row updated
        DB-->>API: {version: 8, updatedAt}
        API-->>E: 200 {version: 8}
        E-->>U: "Saved"
    else 0 rows (stale)
        API-->>E: 409 CONFLICT
        E-->>U: Banner "Updated elsewhere — Reload"
    end
```

### 6.2 Import file → new document

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant UI as Import dialog
    participant API as POST /api/documents/import
    participant IMP as lib/import
    participant DB as Neon

    U->>UI: choose notes.docx
    UI->>UI: client check: ext + size ≤ 2MB
    UI->>API: multipart/form-data
    API->>API: server check: size, ext, magic bytes
    API->>IMP: toTiptapJSON(buffer, kind)
    Note over IMP: txt → paragraphs<br/>md → marked → HTML → JSON<br/>docx → mammoth → HTML → JSON
    IMP-->>API: {json, text}
    API->>DB: INSERT documents (title = filename)
    API-->>UI: 201 {id}
    UI->>U: router.push(/docs/id)
```

### 6.3 Share

```mermaid
sequenceDiagram
    autonumber
    actor A as Alice (owner)
    participant D as Share dialog
    participant API as POST /api/documents/:id/shares
    participant DB as Neon
    actor B as Bob

    A->>D: email bob@ajaia.dev, role Editor
    D->>API: {email, role}
    API->>API: assert owner, email != self
    API->>DB: SELECT user by email
    API->>DB: INSERT ... ON CONFLICT (doc,user) DO UPDATE SET role
    API-->>D: 201 share
    B->>DB: (later) GET /docs → shared list includes doc
```

## 7. Deployment & environments

```mermaid
flowchart LR
    Dev["Local: npm run dev"] -->|DATABASE_URL dev branch| NeonDev[(Neon branch: dev)]
    GH[GitHub repo] -->|push main| Vercel[Vercel build<br/>next build]
    Vercel -->|DATABASE_URL main| NeonMain[(Neon branch: main)]
    Tests[npm test] --> PGlite[("PGlite in-memory<br/>for integration tests")]
```

- **Env vars:** `DATABASE_URL` (Neon pooled connection string), `SESSION_SECRET` (≥32 chars).
- **Migrations:** `drizzle-kit generate` → committed SQL in `drizzle/`; `drizzle-kit migrate` run locally against prod before deploy (documented), seed via `npm run db:seed`.
- **Neon branching** gives an isolated dev DB for free.

## 8. Cross-cutting concerns

| Concern | Approach |
|---|---|
| Validation | Zod schemas shared by client + server (`lib/validation.ts`). |
| Errors | `AppError(code, status, message)` → handler wrapper maps to JSON `{error:{code,message}}`; client maps codes to toasts. |
| Security | httpOnly + SameSite=Lax + Secure cookie; authz per request (not relying on middleware alone); no raw HTML rendering — content rendered by Tiptap from schema-validated JSON; import HTML passes through Tiptap schema which drops unknown tags/attrs (scripts, styles, iframes). |
| Observability | Structured `console.error` in handler wrapper (visible in Vercel logs). |
| Testing | Vitest unit (access matrix, import parsers, validation) + integration (services against PGlite with real migrations). Optional Playwright smoke. |

## 9. Scalability path (documented, not built)

- Real-time: add Yjs + Hocuspocus/Liveblocks; `content` becomes a Yjs snapshot.
- Large docs: move to delta saves / Yjs updates instead of full-doc PATCH.
- Search: Postgres `tsvector` on `content_text` + GIN index.
- Files: Vercel Blob/S3 for attachments with signed URLs.
- Auth: replace `lib/session.ts` internals with Auth.js / Clerk; rest of the app unchanged.
