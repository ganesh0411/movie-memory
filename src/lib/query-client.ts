import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

// Retrying a 4xx won't change the answer; retry transient failures only.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

// Shared by the app (Providers) and tests, so tests exercise the real defaults.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // networkMode "always": run requests even when the browser reports
      // offline. The default ("online") pauses them until navigator comes back,
      // which left optimistic saves stuck on "Saving…" with no feedback. Now an
      // offline request fails fast with NETWORK_ERROR → rollback + message.
      //
      // refetchOnReconnect: true must be explicit: TanStack defaults it to
      // `networkMode !== "always"`, i.e. off. Without it, a query whose re-sync
      // failed while offline (e.g. ["me"] after a lost save response) stays
      // wrong after the connection returns. The fact query opts out, because
      // each fetch is an OpenAI call.
      queries: { retry: shouldRetry, networkMode: "always", refetchOnReconnect: true },
      mutations: { networkMode: "always" },
    },
  });
}
