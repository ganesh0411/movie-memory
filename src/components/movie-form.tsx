"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function MovieForm() {
  const [movie, setMovie] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: api.updateMovie,
    onSuccess: (me) => {
      queryClient.setQueryData(["me"], me);
      router.replace("/dashboard");
      // Server components re-read the session, which now has favoriteMovie.
      router.refresh();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(movie);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <label htmlFor="movie" className="font-medium">
        What&apos;s your favorite movie?
      </label>
      <input
        id="movie"
        name="movie"
        value={movie}
        onChange={(e) => setMovie(e.target.value)}
        maxLength={100}
        autoFocus
        placeholder="e.g. Spirited Away"
        aria-invalid={mutation.isError}
        aria-describedby={mutation.isError ? "movie-error" : undefined}
        className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {mutation.isError && (
        <p id="movie-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {mutation.error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending || mutation.isSuccess}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {mutation.isPending || mutation.isSuccess ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
