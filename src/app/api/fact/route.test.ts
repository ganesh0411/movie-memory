// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only throws outside React Server Components; it's a no-op here.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/dal", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { fact: { create: vi.fn() } } }));
vi.mock("@/lib/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai")>()),
  generateMovieFact: vi.fn(),
}));

import { GET } from "./route";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { generateMovieFact, UpstreamError } from "@/lib/openai";
import { ErrorBody, Fact } from "@/lib/schemas";

const user = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  image: null,
  favoriteMovie: "Alien",
};

const getUser = vi.mocked(getCurrentUser);
const generate = vi.mocked(generateMovieFact);
const createFact = vi.mocked(db.fact.create);

function call(url = "http://localhost/api/fact") {
  return GET(new Request(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/fact", () => {
  it("returns 401 when signed out and does no work", async () => {
    getUser.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(401);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(generate).not.toHaveBeenCalled();
    expect(createFact).not.toHaveBeenCalled();
  });

  it("returns 409 NO_FAVORITE_MOVIE when the user has no movie", async () => {
    getUser.mockResolvedValue({ ...user, favoriteMovie: null });

    const res = await call();

    expect(res.status).toBe(409);
    expect(ErrorBody.parse(await res.json()).error.code).toBe("NO_FAVORITE_MOVIE");
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns 502 UPSTREAM_ERROR when OpenAI fails, without leaking details", async () => {
    getUser.mockResolvedValue(user);
    generate.mockRejectedValue(
      new UpstreamError("OpenAI request failed", { cause: new Error("401 bad key sk-secret") }),
    );

    const res = await call();
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(ErrorBody.parse(JSON.parse(text)).error.code).toBe("UPSTREAM_ERROR");
    expect(text).not.toMatch(/sk-secret|bad key|OpenAI request failed/);
    expect(createFact).not.toHaveBeenCalled();
  });

  it("generates, stores, and returns a fact for the session user", async () => {
    getUser.mockResolvedValue(user);
    generate.mockResolvedValue("Alien's chestburster scene surprised the cast.");
    createFact.mockResolvedValue({
      id: "fact-1",
      movie: "Alien",
      content: "Alien's chestburster scene surprised the cast.",
      createdAt: new Date("2026-11-17T12:00:00Z"),
    } as never);

    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { data } = await res.json();
    expect(Fact.parse(data)).toEqual({
      id: "fact-1",
      movie: "Alien",
      content: "Alien's chestburster scene surprised the cast.",
      createdAt: "2026-11-17T12:00:00.000Z",
    });
    expect(generate).toHaveBeenCalledWith("Alien");
    expect(createFact).toHaveBeenCalledTimes(1);
    expect(createFact.mock.calls[0][0].data).toEqual({
      userId: "user-1",
      movie: "Alien",
      content: "Alien's chestburster scene surprised the cast.",
    });
  });

  it("ignores any userId in the request and writes for the session user only", async () => {
    getUser.mockResolvedValue(user);
    generate.mockResolvedValue("A fact.");
    createFact.mockResolvedValue({
      id: "fact-2",
      movie: "Alien",
      content: "A fact.",
      createdAt: new Date(),
    } as never);

    await call("http://localhost/api/fact?userId=someone-else");

    expect(createFact.mock.calls[0][0].data.userId).toBe("user-1");
  });

  it("returns 500 INTERNAL for unexpected errors (e.g. DB down)", async () => {
    getUser.mockResolvedValue(user);
    generate.mockResolvedValue("A fact.");
    createFact.mockRejectedValue(new Error("connection refused"));

    const res = await call();
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(ErrorBody.parse(JSON.parse(text)).error.code).toBe("INTERNAL");
    expect(text).not.toMatch(/connection refused/);
  });
});
