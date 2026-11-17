import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api-server";
import { generateMovieFact, UpstreamError } from "@/lib/openai";
import type { Fact } from "@/lib/schemas";

// GET with a side effect (creates a Fact row) is deliberate: the spec names
// GET /api/fact, and next step it becomes "return the recent fact, generating
// only if stale". Responses are no-store (see api-server.ts).
export const GET = withUser(async (_req, user) => {
  // The user (and favoriteMovie) come from the session, loaded fresh from the
  // DB each request. Nothing is read from the request itself.
  const movie = user.favoriteMovie;
  if (!movie) {
    return fail(409, "NO_FAVORITE_MOVIE", "Pick a favorite movie first.");
  }

  let content: string;
  try {
    content = await generateMovieFact(movie);
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err; // withUser → 500
    console.error("[api] GET /api/fact: OpenAI failed", err.cause ?? err);
    return fail(
      502,
      "UPSTREAM_ERROR",
      "Couldn't come up with a fact right now. Please try again.",
    );
  }

  const row = await db.fact.create({
    data: { userId: user.id, movie, content },
    select: { id: true, movie: true, content: true, createdAt: true },
  });

  const fact: Fact = { ...row, createdAt: row.createdAt.toISOString() };
  return ok(fact);
});
