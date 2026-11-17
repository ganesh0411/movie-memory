import { db } from "@/lib/db";
import { ok, readJson, withUser } from "@/lib/api-server";
import { MovieInput, type Me } from "@/lib/schemas";

export const PUT = withUser(async (req, user) => {
  const input = await readJson(req, MovieInput);
  if (!input.ok) return input.response;

  // Only ever the session user's row. MovieInput has no userId field, and
  // Zod strips unknown keys, so a client can't target another user.
  const updated: Me = await db.user.update({
    where: { id: user.id },
    data: { favoriteMovie: input.data.movie },
    select: { id: true, name: true, email: true, image: true, favoriteMovie: true },
  });

  return ok(updated);
});
