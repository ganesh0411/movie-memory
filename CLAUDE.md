# Movie Memory — take-home (Variant B: Frontend/API-focused)

## Stack
Next.js (App Router), TypeScript, Tailwind, Prisma, Postgres (Neon), Auth.js (Google OAuth), OpenAI API.

## Libraries
TanStack Query (client cache/optimistic UI), Zod (shared validation + API contracts), Vitest + React Testing Library + MSW (tests).

## Rules
- Plan before coding. Small steps, one feature at a time.
- After each change, explain WHAT changed and WHY in 3–5 bullets.
- Never commit secrets. Use .env (gitignored) + .env.example.
- userId always comes from the server session, never from client input.
- Validate movie input server-side with Zod (trim, 1–100 chars).
- All API routes return { data } or { error: { code, message } }.
- Prefer simple, readable code over clever code.
