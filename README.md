# Movie Memory

Sign in with Google, save your favorite movie, and get short AI-generated fun facts about it.
Take-home project, **Variant B (frontend/API-focused)**.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind · Prisma 7 + Neon Postgres ·
Auth.js (Google, database sessions) · OpenAI · TanStack Query · Zod · Vitest + RTL + MSW

---

## Setup

Prerequisites: Node 20.9+, a [Neon](https://neon.tech) Postgres database, a Google OAuth
client, and an OpenAI API key.

```bash
npm install                 # also runs `prisma generate`; works without a .env
cp .env.example .env        # fill in the values (see below)
npx prisma migrate deploy   # create the tables
npm run dev                 # http://localhost:3000
```

Google OAuth client (Google Cloud Console → Credentials → OAuth client ID, type "Web"):
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Checks:

```bash
npm test            # Vitest: unit, route handler, and component tests
npx tsc --noEmit    # type-check
npm run lint
```

## Environment variables

All variables are listed in [`.env.example`](.env.example). `.env` is gitignored. Secrets are
only read on the server, so none of them reach the browser.

| Variable | Required | Used by | How to get it |
|---|---|---|---|
| `DATABASE_URL` | yes | app at runtime | Neon **pooled** connection string |
| `DIRECT_URL` | for migrations | Prisma CLI | Neon **direct** (unpooled) connection string |
| `AUTH_SECRET` | yes | Auth.js | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | yes | Auth.js | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | yes | Auth.js | Google OAuth client secret |
| `OPENAI_API_KEY` | yes | `src/lib/openai.ts` | OpenAI dashboard |
| `OPENAI_MODEL` | no | `src/lib/openai.ts` | Defaults to `gpt-5.4-nano` |

Migrations need `DIRECT_URL` because Neon's pooler (PgBouncer, transaction mode) breaks
`prisma migrate`'s advisory locks. The app itself uses the pooled URL, so serverless
invocations don't exhaust Postgres connections.

## Database & migrations

| Task | Command |
|---|---|
| Apply existing migrations (first setup, CI, deploy) | `npx prisma migrate deploy` |
| Change the schema during development | edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` |
| Browse data | `npx prisma studio` |

- Prisma 7 configuration lives in `prisma.config.ts`, which the CLI uses with `DIRECT_URL`.
  The runtime client is created in `src/lib/db.ts` with the Neon driver adapter.
- The generated client is written to `src/generated/prisma`.
- Models:
  - **Auth.js tables:** `User`, `Account`, `Session`, `VerificationToken`.
  - **`User.favoriteMovie`:** `null` means onboarding isn't done.
  - **`Fact`:** `userId`, `movie` (a copy of the movie at generation time, so editing the movie
    doesn't rewrite history), `content`, `createdAt`. Index on `(userId, createdAt)`.

## Architecture

### Layers

```
 Browser
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Components (client)   MoviePanel · MovieEditor · FactCard · MovieForm │
 │ TanStack Query        queries.ts (keys, cache rules, optimistic save) │
 │                       query-client.ts (retry, networkMode, reconnect) │
 │ Typed API client      api.ts → every failure becomes ApiError         │
 └───────────────────────────────┬───────────────────────────────────────┘
                                 │ fetch  /api/*   (JSON: { data } | { error })
 Server (Next.js)                ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Pages (server comps)  /  ·  /onboarding  ·  /dashboard                │
 │                       read the session, redirect, render initial data │
 │ Server entry points   actions/auth.ts (sign in/out)                   │
 │                       api/me · api/me/movie · api/fact (withUser)     │
 │ lib (server-only)     dal.ts (session → user) · api-server.ts         │
 │                       (ok/fail/withUser/readJson) · openai.ts · db.ts │
 │ lib (shared)          schemas.ts: Zod contract used by both sides     │
 └──────────┬─────────────────────────┬──────────────────────┬───────────┘
            ▼                         ▼                      ▼
     Google OAuth             Neon Postgres (Prisma)      OpenAI API
```

| Folder | Contents |
|---|---|
| `src/app` | Pages, `layout.tsx` + `providers.tsx` (QueryClient), `actions/`, `api/` route handlers |
| `src/components` | Client components and their tests |
| `src/lib` | `schemas` (shared), `api` / `queries` / `query-client` (client), `dal` / `api-server` / `openai` / `db` (server) |
| `src/auth.ts` | Auth.js config: Google provider, Prisma adapter, database sessions |
| `prisma/` | Schema and migrations |

### API contract

| Route | Success | Errors |
|---|---|---|
| `GET /api/me` | `{ data: Me }` | 401 |
| `PUT /api/me/movie` `{ movie }` | `{ data: Me }` | 400, 401 |
| `GET /api/fact` | `{ data: Fact }`, generated and stored | 401, 409, 502 |

- **Response shape.** Every response is `{ data }` or `{ error: { code, message } }`, with
  `Cache-Control: no-store`.
- **Error codes.**
  - From the server:

    | Code | Status |
    |---|---|
    | `UNAUTHORIZED` | 401 |
    | `VALIDATION_ERROR` | 400 |
    | `NOT_FOUND` | 404 |
    | `NO_FAVORITE_MOVIE` | 409 |
    | `UPSTREAM_ERROR` | 502 |
    | `INTERNAL` | 500 |

  - Added by the client: `NETWORK_ERROR` (no response at all) and `BAD_RESPONSE` (the response
    doesn't match the contract).
- **The user always comes from the session.** `withUser` reads it on the server, so no route
  accepts a user id from the request. API routes answer with 401 JSON, never a redirect.
  Unexpected errors become a generic 500: details go to the server log, not the response.
- **Zod on both sides.** `schemas.ts` is the single source of truth.
  - The server validates input with it (the authority).
  - The client uses the same `MovieInput` for instant feedback.
  - The client also parses every response, so a mismatched contract fails clearly as
    `BAD_RESPONSE` instead of surfacing as `undefined` deep in the UI.
- **One error type on the client.** `api.ts` turns HTTP errors, non-JSON bodies (such as a proxy
  error page), network failures and bad shapes into a single `ApiError { status, code, message }`.

### Key flows

**1. Sign-in and routing**
1. "Sign in with Google" submits a server action → `signIn("google")` → Google → Auth.js
   callback.
2. The Prisma adapter creates or links the `User` and stores a `Session` row (database sessions,
   so logout really revokes the session).
3. The user lands on `/`. `homePathFor(user)` sends them to `/onboarding` if `favoriteMovie` is
   `null`, otherwise to `/dashboard`.
4. Every page re-checks the session on the server (`requireUser()` plus a redirect), so typing a
   URL can't skip onboarding or reach the dashboard signed out.
5. The session callback loads the `User` row on each request, so `favoriteMovie` is always
   current.

**2. Optimistic inline edit** (`useUpdateMovie` in `src/lib/queries.ts`)
1. The title is validated with `MovieInput` first. An invalid title is rejected without a
   request, so it never flashes on screen.
2. `onMutate`:
   - cancels any in-flight refresh of the user (`["me"]`), so a late response can't overwrite
     the new title;
   - saves a snapshot of the current user;
   - shows the new title immediately.
3. The request is `PUT /api/me/movie`. On a network error, the client first asks the server what
   it has (`GET /api/me`): the save may have committed with only the response lost. If it did,
   that counts as success.
4. `onError` restores the snapshot, shows the message and reopens the editor with the draft.
   `onSuccess` stores the server's version and removes cached facts for other movies.
5. `onSettled` invalidates `["me"]`, which re-syncs with the server either way. If that fails too
   (offline), it heals on reconnect or when the window regains focus.

**3. Fact cache** (`factQuery` in `src/lib/queries.ts`)
1. Facts are cached per user and movie (key `["fact", userId, movie]`) with `staleTime: 30s`. Its
   timestamp is the query's `dataUpdatedAt`.
2. Opening the card again within 30s shows the cached fact with no request. After 30s, it fetches
   a new one. "New fact" always fetches. Window focus and reconnect never trigger a fetch, because
   each fetch is an OpenAI call.
3. Changing the movie changes the key, and old-movie entries are removed on a successful save.
4. While a save is pending, no fact is fetched. The server still has the old movie at that point,
   so a fetch would cache an old-movie fact under the new key.
5. A fact is only shown if its stored `movie` matches the movie on screen.
6. If a "New fact" request fails, the current fact stays visible with a small note below it.

## Why Variant B

I chose Variant B deliberately, to build depth in **React state management and API contracts**,
the areas I want to be strong in for full-stack roles. The interesting problems sit on the client
side:
- optimistic updates and rollback;
- cache keys and invalidation;
- races between a pending save and a fetch;
- honest error states when offline.

My backend background helped with the server half: auth boundaries, server-side validation, and
a consistent error contract that the client can rely on.

## Key tradeoffs

| Decision | Why | Cost |
|---|---|---|
| **`GET /api/fact` creates a row** | The spec names it. Reading a fact maps onto `useQuery` (caching, staleness, refetch). Responses are `no-store`. | GET should have no side effects: anything that requests the URL (a reload, a direct hit, a cross-site navigation) triggers a generation. See "What I'd improve". |
| **Redirects in server components, not `proxy`/middleware** | With database sessions, checking the session needs a database read. The page-level check is authoritative, and the routing rule is one pure function (`homePathFor`). | Each protected page runs its own check, behind `Suspense` (required by `cacheComponents`). There's no edge-level gate. |
| **In-memory fact cache, not `sessionStorage`** | A reload is a deliberate fresh start. Nothing per-user is left in the browser, so there's nothing to clear on sign-out on a shared machine. | A reload within 30s spends one extra OpenAI call and row. |
| **`networkMode: "always"` + verify-before-rollback** | TanStack Query's default (`"online"`) pauses requests while the browser reports offline, which left a save stuck on "Saving…" with no feedback. Now offline saves fail fast and roll back. A network error means "outcome unknown", so the client checks with the server before rolling back. | No automatic retry of offline saves; the user presses Save again. `refetchOnReconnect` must be set explicitly, because `"always"` turns it off by default. |
| **Adapter typing** | Module augmentation types `Session.user` (`id`, `favoriteMovie`). The session callback needs one narrow cast, because Auth.js's adapter user type has no `favoriteMovie`. | The cast isn't checked against the Prisma schema. The alternative is augmenting `AdapterUser` too. |
| **Invisible-character handling** | `MovieInput` strips invisible formatting characters (zero-width spaces, BOM, soft hyphen, bidi controls) before trimming and requires one visible character. It keeps ZWJ/ZWNJ, which carry meaning in emoji sequences and scripts like Persian. | Some rare edge cases still pass, such as a title made only of combining marks. |

## What I'd improve

- **Server-side cap on fact generation.** The 30-second fact cache is client-only
  (TanStack Query, in memory). `GET /api/fact` still calls OpenAI and stores a row on
  every request that reaches it: a reload, a direct hit on the URL, or a cross-site
  top-level navigation (the `SameSite=Lax` session cookie is sent on those). I'd add:
  - a server check: if this user got a fact for this movie in the last 30s, return
    it without calling OpenAI. The lookup must filter on the session user's id, with
    a test for that.
  - a per-user rate limit (e.g. N generations per minute), so "New fact" can skip
    the 30s check without making the cap meaningless.
- **Re-sync when the network returns without an "online" event.** If a save's
  response is lost (the server committed, the client didn't hear back) and the
  follow-up check fails too, the client rolls back and marks `["me"]` stale. It heals
  on the next reconnect event or window focus. But if the network recovers without the
  browser ever reporting offline (a server or proxy blip, flaky Wi-Fi) and the tab
  keeps focus, the UI shows the old movie until something triggers a refetch. Options:
  - light polling of `["me"]` (e.g. `refetchInterval` while a query is in error), or
  - versioned writes: the PUT carries the version the client last saw and the server
    returns the current one, so a retried or "lost" save resolves without guessing.
- **Persisting the fact cache across reloads** (`sessionStorage` keyed by user +
  movie) was considered and declined. A reload is a deliberate fresh start, and 30s
  is too short a window to justify per-user storage keys, clearing it on sign-out on
  shared machines, and showing stored facts only after the page loads in the
  browser. Cost: a reload within 30s spends one extra OpenAI call.
- **GET vs POST.** `GET /api/fact` creates a row, which HTTP semantics discourage.
  I kept GET because the spec names it and it maps onto `useQuery`; with the server
  cap above it becomes mostly a read. Otherwise I'd split it into
  `POST /api/fact` (generate) and `GET /api/fact/latest` (read).
- **More UI tests:** an RTL test for the onboarding form.

## AI usage

- **Claude Code wrote most of the implementation**, in plan mode, one step at a time.
- **I set the scope of each step and approved every plan before code was written.** Changes I
  requested during review (several suggested by a second Claude chat I used as a reviewer):
  - no client auto-retry for OpenAI errors (avoids ~60s waits and repeated API calls);
  - `refetchOnReconnect` kept off for facts, since each fetch is an OpenAI call;
  - root-cause investigation before fixing the sync bug, instead of only patching the symptom;
  - splitting the sync fix into its own commit.
- **I tested every step manually** and found both offline bugs that way:
  - a save made while offline stuck on "Saving…" forever;
  - after a lost response, the UI showed the old movie while the database had the new one.
- Each fix was reproduced first and is covered by a test verified to fail without the fix.
