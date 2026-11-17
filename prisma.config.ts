// Prisma 7 no longer auto-loads .env, so load it explicitly (no-op if absent).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI (migrate/introspect) uses Neon's DIRECT (unpooled) URL:
    // PgBouncer transaction pooling breaks migrate's advisory locks.
    //
    // Read process.env directly instead of prisma's env() helper, which throws
    // at config load. `prisma generate` (run on postinstall) needs no DB, so
    // `npm install` must work without a .env. Commands that do need a DB
    // (migrate, db push, studio) still fail if DIRECT_URL is unset.
    url: process.env.DIRECT_URL,
  },
});
