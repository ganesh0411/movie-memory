// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    responses = { create };
  },
}));

import { generateMovieFact, UpstreamError } from "@/lib/openai";

// Braces matter: a function returned from beforeEach runs as a teardown.
beforeEach(() => {
  create.mockReset();
});

describe("generateMovieFact", () => {
  it("returns the trimmed text and keeps the title out of the instructions", async () => {
    create.mockResolvedValue({ output_text: "  A fun fact.  " });

    await expect(generateMovieFact("Alien")).resolves.toBe("A fun fact.");

    const params = create.mock.calls[0][0];
    expect(params.input).toContain("Alien");
    expect(params.instructions).not.toContain("Alien");
    expect(params.max_output_tokens).toBeLessThanOrEqual(150);
  });

  it("wraps SDK errors and timeouts in UpstreamError, keeping the cause", async () => {
    const timeout = new Error("Request timed out.");
    create.mockRejectedValue(timeout);

    const err = await generateMovieFact("Alien").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).cause).toBe(timeout);
  });

  it("treats empty output as an UpstreamError", async () => {
    create.mockResolvedValue({ output_text: "   " });
    await expect(generateMovieFact("Alien")).rejects.toBeInstanceOf(UpstreamError);
  });
});
