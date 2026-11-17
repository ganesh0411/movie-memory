import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  // Runtime uses Neon's POOLED url so serverless invocations don't exhaust
  // Postgres connections. Migrations use DIRECT_URL (see prisma.config.ts).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// Reuse one client across Next.js dev hot reloads to avoid leaking connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
