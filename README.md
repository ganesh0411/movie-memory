This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
