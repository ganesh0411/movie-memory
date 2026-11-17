import { z } from "zod";

// Single source of truth for the API contract. Imported by route handlers
// (input validation) AND by the browser client (input pre-check + response
// parsing), so both sides always agree on shapes and rules.

// ---------- Inputs ----------

export const MovieInput = z.object({
  movie: z
    .string()
    .trim()
    .min(1, "Please enter a movie title.")
    .max(100, "Movie title must be 100 characters or fewer."),
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
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
