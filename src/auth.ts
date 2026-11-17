import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

// AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are read from env automatically.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Google],
  // Sessions live in the DB (revocable; logout deletes the row).
  session: { strategy: "database" },
  callbacks: {
    // With database sessions, `user` is the full User row loaded alongside the
    // session in one query, so favoriteMovie is always current.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.favoriteMovie =
        (user as { favoriteMovie?: string | null }).favoriteMovie ?? null;
      return session;
    },
  },
});
