import { describe, expect, it } from "vitest";
import { displayName, initials } from "./user-display";

describe("initials", () => {
  it("uses first letters of up to two words", () => {
    expect(initials({ name: "ada lovelace byron", email: null })).toBe("AL");
  });
  it("handles a single name", () => {
    expect(initials({ name: "Cher", email: null })).toBe("C");
  });
  it("falls back to email when name is missing or blank", () => {
    expect(initials({ name: null, email: "zoe@example.com" })).toBe("Z");
    expect(initials({ name: "   ", email: "zoe@example.com" })).toBe("Z");
  });
  it("falls back to ? when nothing is known", () => {
    expect(initials({ name: null, email: null })).toBe("?");
  });
});

describe("displayName", () => {
  it("prefers name, then email, then a generic label", () => {
    expect(displayName({ name: "Ada", email: "a@x.com" })).toBe("Ada");
    expect(displayName({ name: null, email: "a@x.com" })).toBe("a@x.com");
    expect(displayName({ name: null, email: null })).toBe("Movie fan");
  });
});
