import { z } from "zod";

// Single source of truth for the API contract. Imported by route handlers
// (input validation) AND by the browser client (input pre-check + response
// parsing), so both sides always agree on shapes and rules.

// ---------- Inputs ----------

// Invisible "format" characters (zero-width space, BOM, soft hyphen, bidi
// controls…), except ZWNJ/ZWJ (U+200C/U+200D), which carry meaning inside
// emoji sequences and scripts like Persian.
const INVISIBLE = /(?![‌‍])\p{Cf}/gu;
// At least one character that is neither whitespace nor invisible.
const VISIBLE = /[^\s\p{Cf}]/u;

export const MovieInput = z.object({
  movie: z
    .string()
    .overwrite((s) => s.replace(INVISIBLE, ""))
    .trim()
    .min(1, "Please enter a movie title.")
    .max(100, "Movie title must be 100 characters or fewer.")
    // Catches titles made only of the joiners kept above.
    .refine((s) => VISIBLE.test(s), "Please enter a movie title."),
});
export type MovieInput = z.infer<typeof MovieInput>;

// ---------- Resources ----------

export const Me = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  // null = user still needs onboarding
  favoriteMovie: z.string().nullable(),
});
export type Me = z.infer<typeof Me>;

export const Fact = z.object({
  id: z.string(),
  movie: z.string(),
  content: z.string(),
  // Dates cross the wire as ISO strings.
  createdAt: z.iso.datetime(),
});
export type Fact = z.infer<typeof Fact>;

// ---------- Envelopes ----------

export const ErrorCode = z.enum([
  "UNAUTHORIZED",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "NO_FAVORITE_MOVIE", // 409: action needs a favorite movie first
  "UPSTREAM_ERROR", // 502: the AI provider failed or timed out
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
