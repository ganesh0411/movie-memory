import { ok, withUser } from "@/lib/api-server";

// The session callback already loaded the current User row, so no extra query.
export const GET = withUser((_req, user) => ok(user));
