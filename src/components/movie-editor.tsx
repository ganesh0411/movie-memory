"use client";

import { useState, type FormEvent } from "react";
import { useUpdateMovie } from "@/lib/queries";
import { MovieInput, type Me } from "@/lib/schemas";

export function MovieEditor({ me }: { me: Me }) {
  // Pure UI state stays in React; server state lives in the query cache.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const mutation = useUpdateMovie();

  const error = localError ?? (mutation.isError ? mutation.error.message : null);

  function startEdit() {
    mutation.reset();
    setLocalError(null);
    setDraft(me.favoriteMovie ?? "");
    setEditing(true);
  }

  function cancel() {
    // The cache was never touched while editing, so the original title is
    // still what's displayed.
    mutation.reset();
    setLocalError(null);
    setEditing(false);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    // Validate before mutate(): onMutate runs before mutationFn, so an invalid
    // title would otherwise flash on screen and then roll back.
    const parsed = MovieInput.safeParse({ movie: draft });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0].message);
      return;
    }
    setLocalError(null);
    setEditing(false);
    if (parsed.data.movie === me.favoriteMovie) return;

    const submitted = draft;
    mutation.mutate(parsed.data.movie, {
      // Reopen with what the user typed so they can fix it or retry.
      onError: () => {
        setDraft(submitted);
        setEditing(true);
      },
    });
  }

  const errorAlert = error && (
    <p id="movie-edit-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  );

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-zinc-600 dark:text-zinc-400">
            Your favorite movie:{" "}
            <strong className="break-words text-zinc-900 dark:text-zinc-100">
              {me.favoriteMovie}
            </strong>
          </p>
          <button
            type="button"
            onClick={startEdit}
            disabled={mutation.isPending}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Edit
          </button>
        </div>
        {errorAlert}
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      noValidate
      onKeyDown={(e) => e.key === "Escape" && cancel()}
      className="flex flex-col gap-2"
    >
      <label htmlFor="movie-edit" className="text-sm text-zinc-600 dark:text-zinc-400">
        Favorite movie
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="movie-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={100}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "movie-edit-error" : undefined}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
      {errorAlert}
    </form>
  );
}
