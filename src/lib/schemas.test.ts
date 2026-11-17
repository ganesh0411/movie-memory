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

  it("strips unknown keys like userId", () => {
    expect(MovieInput.parse({ movie: "Alien", userId: "someone-else" })).toEqual({ movie: "Alien" });
  });
});
