"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FactCard } from "@/components/fact-card";
import { MovieEditor } from "@/components/movie-editor";
import { meQuery } from "@/lib/queries";
import type { Me } from "@/lib/schemas";

// Client half of the dashboard. ["me"] is seeded with the server-rendered user
// so it can be updated optimistically; it's only refetched when invalidated.
export function MoviePanel({ initialMe }: { initialMe: Me }) {
  const { data: me } = useQuery({ ...meQuery, initialData: initialMe, staleTime: Infinity });

  if (!me.favoriteMovie) {
    return (
      <p>
        <Link href="/onboarding" className="underline">
          Choose your favorite movie
        </Link>{" "}
        to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <MovieEditor me={me} />
      <FactCard userId={me.id} movie={me.favoriteMovie} />
    </div>
  );
}
