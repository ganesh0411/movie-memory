import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw";
import { api, ApiError } from "@/lib/api";

const me = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  image: null,
  favoriteMovie: "Alien",
};

// Runs `fn`, asserts it rejects with an ApiError, and returns that error.
async function catchApiError(fn: () => Promise<unknown>): Promise<ApiError> {
  const err = await fn().then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

describe("api.getMe", () => {
  it("returns typed data on success", async () => {
    server.use(http.get("*/api/me", () => HttpResponse.json({ data: me })));
    await expect(api.getMe()).resolves.toEqual(me);
  });

  it("maps 401 to UNAUTHORIZED with the server message", async () => {
    server.use(
      http.get("*/api/me", () =>
        HttpResponse.json(
          { error: { code: "UNAUTHORIZED", message: "You need to sign in." } },
          { status: 401 },
        ),
      ),
    );
    const err = await catchApiError(api.getMe);
    expect(err).toMatchObject({ status: 401, code: "UNAUTHORIZED", message: "You need to sign in." });
  });

  it("maps 500 to INTERNAL", async () => {
    server.use(
      http.get("*/api/me", () =>
        HttpResponse.json({ error: { code: "INTERNAL", message: "boom" } }, { status: 500 }),
      ),
    );
    const err = await catchApiError(api.getMe);
    expect(err).toMatchObject({ status: 500, code: "INTERNAL" });
  });

  it("maps a non-JSON error body by status (e.g. proxy HTML 502)", async () => {
    server.use(
      http.get("*/api/me", () => HttpResponse.text("<html>Bad Gateway</html>", { status: 502 })),
    );
    const err = await catchApiError(api.getMe);
    expect(err).toMatchObject({ status: 502, code: "INTERNAL" });
  });

  it("maps a network failure to NETWORK_ERROR with status 0", async () => {
    server.use(http.get("*/api/me", () => HttpResponse.error()));
    const err = await catchApiError(api.getMe);
    expect(err).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("maps a 200 with the wrong shape to BAD_RESPONSE", async () => {
    const partial: Partial<typeof me> = { ...me };
    delete partial.favoriteMovie;
    server.use(http.get("*/api/me", () => HttpResponse.json({ data: partial })));
    const err = await catchApiError(api.getMe);
    expect(err).toMatchObject({ status: 200, code: "BAD_RESPONSE" });
  });

  it("maps a 200 without the { data } envelope to BAD_RESPONSE", async () => {
    server.use(http.get("*/api/me", () => HttpResponse.json(me)));
    const err = await catchApiError(api.getMe);
    expect(err.code).toBe("BAD_RESPONSE");
  });
});

describe("api.updateMovie", () => {
  it("sends the trimmed movie and returns the updated user", async () => {
    let sent: unknown;
    server.use(
      http.put("*/api/me/movie", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ data: { ...me, favoriteMovie: "Alien" } });
      }),
    );
    await expect(api.updateMovie("  Alien  ")).resolves.toMatchObject({ favoriteMovie: "Alien" });
    expect(sent).toEqual({ movie: "Alien" });
  });

  it("passes through the server's VALIDATION_ERROR message", async () => {
    server.use(
      http.put("*/api/me/movie", () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Server says no." } },
          { status: 400 },
        ),
      ),
    );
    const err = await catchApiError(() => api.updateMovie("Alien"));
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_ERROR", message: "Server says no." });
  });

  it("rejects invalid input locally without a request", async () => {
    // No handler registered: onUnhandledFrame: "error" would fail if it fetched.
    const err = await catchApiError(() => api.updateMovie("   "));
    expect(err).toMatchObject({ code: "VALIDATION_ERROR", message: "Please enter a movie title." });
  });
});
