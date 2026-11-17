import { describe, expect, it } from "vitest";
import { homePathFor } from "./home-path";

describe("homePathFor", () => {
  it("sends users without a favorite movie to onboarding", () => {
    expect(homePathFor({ favoriteMovie: null })).toBe("/onboarding");
  });
  it("sends onboarded users to the dashboard", () => {
    expect(homePathFor({ favoriteMovie: "Arrival" })).toBe("/dashboard");
  });
});
