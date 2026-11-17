"use client";

import Link from "next/link";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { factQuery, UPDATE_MOVIE_KEY } from "@/lib/queries";

export function FactCard({ userId, movie }: { userId: string; movie: string }) {
  // While a movie save is pending, `movie` is the optimistic (unsaved) title.
  // The server still has the old movie, so fetching now would cache an
  // old-movie fact under the new key. Wait until the save settles.
  const saving = useIsMutating({ mutationKey: UPDATE_MOVIE_KEY }) > 0;

  const { data, error, isFetching, refetch } = useQuery({
    ...factQuery(userId, movie),
    enabled: !saving,
  });

  // Backstop: each fact records the movie it was generated for. Never show a
  // fact for a different movie than the one on screen.
  const fact = data && data.movie === movie ? data : undefined;
  const needsMovie = error instanceof ApiError && error.code === "NO_FAVORITE_MOVIE";

  return (
    <section
      aria-labelledby="fact-heading"
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <h2 id="fact-heading" className="font-medium">
        Fun fact
      </h2>

      {saving ? (
        <p className="text-zinc-500">Saving your movie…</p>
      ) : fact ? (
        // A failed refetch keeps the fact we already have for this movie and
        // adds a small note, instead of replacing it with an error.
        <>
          {fact.content ? (
            <p className={isFetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
              {fact.content}
            </p>
          ) : (
            <p className="text-zinc-500">No fact yet. Try generating one.</p>
          )}
          {error && !isFetching && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              Couldn&apos;t get a new fact: {error.message}
            </p>
          )}
        </>
      ) : error && !isFetching ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error.message}{" "}
          {needsMovie && (
            <Link href="/onboarding" className="underline">
              Choose a movie
            </Link>
          )}
        </p>
      ) : (
        <div aria-busy="true" aria-label="Loading fact" className="flex flex-col gap-2">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      )}

      {!needsMovie && (
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching || saving}
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isFetching ? "Thinking…" : error && !fact ? "Try again" : "New fact"}
        </button>
      )}
    </section>
  );
}
