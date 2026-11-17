import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "@/test/msw";
import { MoviePanel } from "@/components/movie-panel";
import { createQueryClient } from "@/lib/query-client";
import type { Me } from "@/lib/schemas";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ---------- Fake backend (stateful MSW handlers) ----------

let serverMovie: string;
let factCalls: number;

function me(): Me {
  return { id: "u1", name: "Ada", email: "ada@example.com", image: null, favoriteMovie: serverMovie };
}

function factHandler() {
  return http.get("*/api/fact", () => {
    factCalls += 1;
    return HttpResponse.json({
      data: {
        id: `f${factCalls}`,
        movie: serverMovie,
        content: `fact #${factCalls} about ${serverMovie}`,
        createdAt: new Date().toISOString(),
      },
    });
  });
}

const meHandler = http.get("*/api/me", () => HttpResponse.json({ data: me() }));

function putHandler(opts: { gate?: Promise<void>; fail?: boolean } = {}) {
  return http.put("*/api/me/movie", async ({ request }) => {
    await opts.gate;
    if (opts.fail) {
      return HttpResponse.json(
        { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
        { status: 500 },
      );
    }
    const { movie } = (await request.json()) as { movie: string };
    serverMovie = movie;
    return HttpResponse.json({ data: me() });
  });
}

// A promise the test resolves to release a held request.
function deferred() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return { gate, release };
}

// ---------- Render helpers ----------

let client: QueryClient;

function renderPanel() {
  return render(
    <QueryClientProvider client={client}>
      <MoviePanel initialMe={me()} />
    </QueryClientProvider>,
  );
}

async function startEditing(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const input = screen.getByLabelText("Favorite movie");
  await user.clear(input);
  if (value) await user.type(input, value);
}

const title = () => screen.getByRole("strong");

beforeEach(() => {
  serverMovie = "Alien";
  factCalls = 0;
  // The app's real client config (retry rules, networkMode).
  client = createQueryClient();
  server.use(meHandler, factHandler());
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

// ---------- Inline edit ----------

describe("inline movie edit", () => {
  it("shows the new title immediately, before the server responds", async () => {
    const user = userEvent.setup();
    const { gate, release } = deferred();
    server.use(putHandler({ gate }));
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await startEditing(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // PUT is still held: the title is already updated (optimistic).
    expect(title()).toHaveTextContent("Heat");

    release();
    await screen.findByText("fact #2 about Heat");
    expect(title()).toHaveTextContent("Heat");
  });

  it("reverts the title and shows the error when the server fails", async () => {
    const user = userEvent.setup();
    server.use(putHandler({ fail: true }));
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await startEditing(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    // Editor reopened with the draft; the cached movie is back to the original.
    expect(screen.getByLabelText("Favorite movie")).toHaveValue("Heat");
    expect(client.getQueryData<Me>(["me"])?.favoriteMovie).toBe("Alien");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(title()).toHaveTextContent("Alien");
    // The old movie's fact was still cached, so it reappears without a request.
    expect(screen.getByText("fact #1 about Alien")).toBeInTheDocument();
    expect(factCalls).toBe(1);
  });

  it("offline: fails fast, rolls back, and says the server is unreachable", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    // What DevTools "Offline" does: the browser reports offline and fetch fails.
    onlineManager.setOnline(false);
    server.use(http.put("*/api/me/movie", () => HttpResponse.error()));

    await startEditing(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Can't reach the server. Check your connection.",
    );
    expect(client.getQueryData<Me>(["me"])?.favoriteMovie).toBe("Alien");
    expect(screen.getByLabelText("Favorite movie")).toHaveValue("Heat");
    // Not stuck: the save settled, so the fact card is back for the old movie.
    expect(screen.queryByText("Saving your movie…")).not.toBeInTheDocument();
    expect(screen.getByText("fact #1 about Alien")).toBeInTheDocument();
  });

  it("Cancel restores the original title without a request", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await startEditing(user, "Something else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // No PUT handler is registered: a request would fail the test (onUnhandledFrame: "error").
    expect(title()).toHaveTextContent("Alien");
    expect(screen.queryByLabelText("Favorite movie")).not.toBeInTheDocument();
  });

  it("rejects invisible-only input locally without a request", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await startEditing(user, "​ ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a movie title.");
    expect(screen.getByLabelText("Favorite movie")).toBeInTheDocument();
    expect(client.getQueryData<Me>(["me"])?.favoriteMovie).toBe("Alien");
  });
});

// ---------- Save commits on the server, response lost on the client ----------

describe("lost save response", () => {
  // The PUT reaches the server and commits, but fetch rejects (response lost).
  const putCommitsThenFails = http.put("*/api/me/movie", async ({ request }) => {
    serverMovie = ((await request.json()) as { movie: string }).movie;
    return HttpResponse.error();
  });

  it("network fine: verifies with the server and ends as a success", async () => {
    const user = userEvent.setup();
    server.use(putCommitsThenFails);
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await startEditing(user, "Jaws");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("fact #2 about Jaws");
    expect(title()).toHaveTextContent("Jaws");
    expect(client.getQueryData<Me>(["me"])?.favoriteMovie).toBe("Jaws");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(client.getQueryData(["fact", "u1", "Alien"])).toBeUndefined();
    // Settled as a success (no rollback / error flash), not healed afterwards.
    expect(client.getMutationCache().getAll()[0].state.status).toBe("success");
  });

  it("offline: rolls back with an error, then heals to the server's value on reconnect", async () => {
    const user = userEvent.setup();
    let netUp = true;
    server.use(
      putCommitsThenFails,
      http.get("*/api/me", () => (netUp ? HttpResponse.json({ data: me() }) : HttpResponse.error())),
    );
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    // DevTools "Offline": the browser reports offline and every request fails.
    onlineManager.setOnline(false);
    netUp = false;
    await startEditing(user, "Jaws");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server.");
    expect(client.getQueryData<Me>(["me"])?.favoriteMovie).toBe("Alien");
    expect(serverMovie).toBe("Jaws"); // the divergence we must heal

    // Let the ["me"] re-sync exhaust its retries (1s + 2s backoff), so only
    // the reconnect can fix the cache.
    await waitFor(
      () => expect(client.getQueryCache().find({ queryKey: ["me"] })?.state.status).toBe("error"),
      { timeout: 5_000 },
    );

    netUp = true;
    act(() => onlineManager.setOnline(true));

    // Healed: cache, title, and fact all match the server; the stale error and
    // reopened editor are gone because the save actually landed.
    await screen.findByText("fact #2 about Jaws", {}, { timeout: 900 });
    expect(client.getQueryData<Me>(["me"])?.favoriteMovie).toBe("Jaws");
    expect(title()).toHaveTextContent("Jaws");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Favorite movie")).not.toBeInTheDocument();
  }, 10_000);
});

// ---------- Fact cache ----------

describe("fact cache", () => {
  it("reuses the fact on a second view within 30s (no request)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));

    const first = renderPanel();
    await screen.findByText("fact #1 about Alien");
    first.unmount();

    vi.setSystemTime(new Date("2026-11-17T12:00:20Z"));
    renderPanel();

    expect(screen.getByText("fact #1 about Alien")).toBeInTheDocument();
    // Give any (unwanted) fetch a chance to happen.
    await new Promise((r) => setTimeout(r, 20));
    expect(factCalls).toBe(1);
  });

  it('"New fact" forces a request within the 30s window', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await user.click(screen.getByRole("button", { name: "New fact" }));

    await screen.findByText("fact #2 about Alien");
    expect(factCalls).toBe(2);
  });

  it("keeps the current fact with a small note when a refetch fails", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    server.use(
      http.get("*/api/fact", () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_ERROR", message: "Couldn't come up with a fact right now." } },
          { status: 502 },
        ),
      ),
    );
    await user.click(screen.getByRole("button", { name: "New fact" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't get a new fact: Couldn't come up with a fact right now.",
    );
    expect(screen.getByText("fact #1 about Alien")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New fact" })).toBeEnabled();
  });

  it("fetches a fresh fact on a view after 30s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));

    const first = renderPanel();
    await screen.findByText("fact #1 about Alien");
    first.unmount();

    vi.setSystemTime(new Date("2026-11-17T12:00:31Z"));
    renderPanel();

    await screen.findByText("fact #2 about Alien");
    expect(factCalls).toBe(2);
  });

  it("doesn't refetch a stale fact on reconnect (each fetch is an OpenAI call)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    vi.setSystemTime(new Date("2026-11-17T12:00:31Z")); // fact is now stale
    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(factCalls).toBe(1);
  });

  it("invalidates the cached fact when the movie changes", async () => {
    const user = userEvent.setup();
    server.use(putHandler());
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await startEditing(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("fact #2 about Heat");
    expect(screen.queryByText(/about Alien/)).not.toBeInTheDocument();
    expect(client.getQueryData(["fact", "u1", "Alien"])).toBeUndefined();
    expect(factCalls).toBe(2);
  });

  it("doesn't fetch a fact while the movie save is pending (race guard)", async () => {
    const user = userEvent.setup();
    const { gate, release } = deferred();
    server.use(putHandler({ gate }));
    renderPanel();
    await screen.findByText("fact #1 about Alien");

    await startEditing(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saving your movie…");
    await new Promise((r) => setTimeout(r, 20));
    expect(factCalls).toBe(1);

    release();
    await screen.findByText("fact #2 about Heat");
    await waitFor(() => expect(factCalls).toBe(2));
    // Exactly one new request, for the new movie.
    await new Promise((r) => setTimeout(r, 20));
    expect(factCalls).toBe(2);
  });
});
