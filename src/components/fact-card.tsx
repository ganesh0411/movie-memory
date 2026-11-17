"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export function FactCard() {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["fact"],
    queryFn: api.getFact,
    // Every fetch costs an OpenAI call: only fetch on mount and on "New fact".
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // The server already retries OpenAI once with a 10s timeout; retrying here
    // too could leave the user waiting a minute.
    retry: false,
  });

  const needsMovie = error instanceof ApiError && error.code === "NO_FAVORITE_MOVIE";

  return (
    <section
      aria-labelledby="fact-heading"
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <h2 id="fact-heading" className="font-medium">
        Fun fact
      </h2>

      {isPending && !error && (
        <div aria-busy="true" aria-label="Loading fact" className="flex flex-col gap-2">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error.message}{" "}
          {needsMovie && (
            <Link href="/onboarding" className="underline">
              Choose a movie
            </Link>
          )}
        </p>
      )}

      {data &&
        (data.content ? (
          <p className={isFetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
            {data.content}
          </p>
        ) : (
          <p className="text-zinc-500">No fact yet. Try generating one.</p>
        ))}

      {!needsMovie && (
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isFetching ? "Thinking…" : error && !data ? "Try again" : "New fact"}
        </button>
      )}
    </section>
  );
}
