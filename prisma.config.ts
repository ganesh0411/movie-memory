// Prisma 7 no longer auto-loads .env, so load it explicitly.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI (migrate/introspect) uses Neon's DIRECT (unpooled) URL:
    // PgBouncer transaction pooling breaks migrate's advisory locks.
    url: env("DIRECT_URL"),
  },
});
