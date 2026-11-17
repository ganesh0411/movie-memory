import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  favoriteMovie: string | null;
};

// Data access layer: the only place pages read the session.
// userId always comes from here (the server session), never from client input.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Force request time. Auth.js generates random values (CSRF token) while
  // reading the session, which cacheComponents/partial prefetching rejects
  // during prerender ("unstable value crypto.getRandomValues()").
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id, name, email, image, favoriteMovie } = session.user;
  return {
    id,
    name: name ?? null,
    email: email ?? null,
    image: image ?? null,
    favoriteMovie,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}
