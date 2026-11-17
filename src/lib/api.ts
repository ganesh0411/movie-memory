import { z } from "zod";
import { ErrorBody, Me, MovieInput, type ErrorCode } from "@/lib/schemas";

// The payload itself is checked against the per-call schema in request().
const DataEnvelope = z.object({ data: z.unknown() });

// Server codes plus two that only the client can detect:
// - NETWORK_ERROR: the request never got a response (offline, DNS, aborted).
// - BAD_RESPONSE: a response arrived but didn't match the contract (a bug).
export type ApiErrorCode = ErrorCode | "NETWORK_ERROR" | "BAD_RESPONSE";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

// Used when an error response has no valid { error } body (e.g. an HTML 502
// page from a proxy).
function codeForStatus(status: number): ErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  if (status === 404) return "NOT_FOUND";
  return "INTERNAL";
}

// Relative URLs work in the browser. Outside one (tests, Node) resolve against
// the current location when it exists.
function toUrl(path: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(path, window.location.origin).toString();
  }
  return path;
}

// Every failure (HTTP error, network error, bad response shape) leaves this
// function as an ApiError. On success it returns data typed by `schema`.
async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  let res: Response;
  try {
    res = await fetch(toUrl(path), {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection.");
  }

  let body: unknown = undefined;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body; handled below.
  }

  if (!res.ok) {
    const parsed = ErrorBody.safeParse(body);
    if (parsed.success) {
      throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message);
    }
    throw new ApiError(res.status, codeForStatus(res.status), FALLBACK_MESSAGE);
  }

  // Check the { data } envelope, then the payload against the expected schema.
  const envelope = DataEnvelope.safeParse(body);
  const parsed = envelope.success ? schema.safeParse(envelope.data.data) : null;
  if (!parsed?.success) {
    throw new ApiError(res.status, "BAD_RESPONSE", "Unexpected response from the server.");
  }
  return parsed.data;
}

export const api = {
  getMe: () => request("/api/me", Me),

  updateMovie: async (movie: string) => {
    // Same rules the server enforces: instant feedback without a round trip.
    // Rejected the same way the server would (400 VALIDATION_ERROR), so the
    // UI handles both identically.
    const input = MovieInput.safeParse({ movie });
    if (!input.success) {
      throw new ApiError(400, "VALIDATION_ERROR", input.error.issues[0].message);
    }
    return request("/api/me/movie", Me, { method: "PUT", body: JSON.stringify(input.data) });
  },
};
