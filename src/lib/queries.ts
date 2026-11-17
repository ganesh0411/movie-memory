import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Me } from "@/lib/schemas";

// Query keys and options in one place so components and tests agree.

export const meQuery = {
  queryKey: ["me"] as const,
  queryFn: api.getMe,
};

// The movie is part of the key, so a fact can never be served for a
// different movie than the one it was generated for.
export function factQuery(userId: string, movie: string) {
  return {
    queryKey: ["fact", userId, movie] as const,
    queryFn: api.getFact,
    // Reuse a fact for 30s: mounting again within the window makes no request.
    // "New fact" calls refetch(), which ignores staleTime.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    // Every fetch costs an OpenAI call; refocusing the tab isn't a new view.
    refetchOnWindowFocus: false,
    // The server already retries OpenAI once with a 10s timeout.
    retry: false,
  };
}

export const UPDATE_MOVIE_KEY = ["updateMovie"] as const;

// Optimistic movie update. Callers pass an already-validated, trimmed title
// (MovieInput); api.updateMovie validates again before sending.
export function useUpdateMovie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: UPDATE_MOVIE_KEY,
    mutationFn: api.updateMovie,

    onMutate: async (movie: string) => {
      // 1. Stop any in-flight ["me"] refetch so it can't land afterwards and
      //    overwrite the optimistic value with the old movie.
      await queryClient.cancelQueries({ queryKey: meQuery.queryKey });
      // 2. Snapshot the current value for rollback.
      const prev = queryClient.getQueryData<Me>(meQuery.queryKey);
      // 3. Show the new title immediately.
      if (prev) {
        queryClient.setQueryData<Me>(meQuery.queryKey, { ...prev, favoriteMovie: movie });
      }
      // 4. Returned value becomes the context passed to onError.
      return { prev };
    },

    onError: (_error, _movie, onMutateResult) => {
      // Exact rollback to the snapshot.
      if (onMutateResult?.prev) {
        queryClient.setQueryData(meQuery.queryKey, onMutateResult.prev);
      }
    },

    onSuccess: (me) => {
      // The server's version wins (it's the stored, normalized value).
      queryClient.setQueryData(meQuery.queryKey, me);
      // Drop cached facts for any other movie. Only on success: after a
      // rollback, the old movie's fact is still cached and reappears instantly.
      queryClient.removeQueries({
        queryKey: ["fact", me.id],
        predicate: (query) => query.queryKey[2] !== me.favoriteMovie,
      });
    },

    onSettled: () => {
      // Re-sync with the server either way (e.g. another tab changed it).
      void queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
    },
  });
}
