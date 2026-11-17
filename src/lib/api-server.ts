import "server-only";
import type { z } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/dal";
import type { ErrorCode } from "@/lib/schemas";

// Every API response is either { data } or { error: { code, message } }.

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function fail(status: number, code: ErrorCode, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

type AuthedHandler = (req: Request, user: CurrentUser) => Promise<Response> | Response;

// Wraps a route handler so that:
// - unauthenticated requests get a 401 JSON body (APIs never redirect), and
// - unexpected errors become a generic 500 (details are logged, never leaked).
// The handler receives the user from the server session; userId is never
// read from client input.
export function withUser(handler: AuthedHandler) {
  return async (req: Request): Promise<Response> => {
    try {
      const user = await getCurrentUser();
      if (!user) return fail(401, "UNAUTHORIZED", "You need to sign in.");
      return await handler(req, user);
    } catch (err) {
      console.error(`[api] ${req.method} ${new URL(req.url).pathname} failed`, err);
      return fail(500, "INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

// Parses and validates a JSON body. Malformed JSON and schema failures both
// become 400 VALIDATION_ERROR with a human-readable message.
export async function readJson<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: fail(400, "VALIDATION_ERROR", "Request body must be valid JSON."),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return { ok: false, response: fail(400, "VALIDATION_ERROR", message) };
  }
  return { ok: true, data: parsed.data };
}
