import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  // Runtime uses Neon's POOLED url so serverless invocations don't exhaust
  // Postgres connections. Migrations use DIRECT_URL (see prisma.config.ts).
  //
  // No connection happens until the first query, so no guard here: `next build`
  // imports this module and must work without DATABASE_URL. A missing URL
  // surfaces on the first query ("No database host or connection string...").
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });
}

// Reuse one client across Next.js dev hot reloads to avoid leaking connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
