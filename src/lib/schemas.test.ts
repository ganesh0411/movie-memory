import { describe, expect, it } from "vitest";
import { MovieInput } from "@/lib/schemas";

describe("MovieInput", () => {
  it("trims whitespace", () => {
    expect(MovieInput.parse({ movie: "  Alien \n" })).toEqual({ movie: "Alien" });
  });

  it.each(["", "   "])("rejects empty or blank input %j", (movie) => {
    expect(MovieInput.safeParse({ movie }).success).toBe(false);
  });

  it("accepts exactly 100 characters", () => {
    expect(MovieInput.safeParse({ movie: "a".repeat(100) }).success).toBe(true);
  });

  it("rejects 101 characters", () => {
    expect(MovieInput.safeParse({ movie: "a".repeat(101) }).success).toBe(false);
  });

  it("counts length after trimming", () => {
    expect(MovieInput.safeParse({ movie: ` ${"a".repeat(100)} ` }).success).toBe(true);
  });

  it.each([
    ["zero-width space", "​"],
    ["BOM", "﻿"],
    ["soft hyphen + spaces", " ­ "],
    ["bidi controls", "\u202E\u2066\u2069"],
    ["joiners only", "‍‌"],
  ])("rejects invisible-only input (%s)", (_label, movie) => {
    expect(MovieInput.safeParse({ movie }).success).toBe(false);
  });

  it("strips invisible characters before trimming", () => {
    expect(MovieInput.parse({ movie: "﻿ Alien​ " })).toEqual({ movie: "Alien" });
  });

  it("keeps ZWJ inside emoji sequences", () => {
    const family = "👨‍👩‍👧";
    expect(MovieInput.parse({ movie: `${family} Movie` })).toEqual({ movie: `${family} Movie` });
  });

  it("doesn't count stripped characters toward the 100 limit", () => {
    expect(MovieInput.safeParse({ movie: "a".repeat(100) + "​".repeat(5) }).success).toBe(true);
  });

  it("strips unknown keys like userId", () => {
    expect(MovieInput.parse({ movie: "Alien", userId: "someone-else" })).toEqual({ movie: "Alien" });
  });
});
