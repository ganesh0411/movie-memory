import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { MovieForm } from "@/components/movie-form";
import { requireUser } from "@/lib/dal";
import { displayName } from "@/lib/user-display";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Welcome to Movie Memory</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <OnboardingGate />
      </Suspense>
    </main>
  );
}

async function OnboardingGate() {
  const user = await requireUser();
  if (user.favoriteMovie !== null) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-600 dark:text-zinc-400">
        Hi {displayName(user)}! Tell us your favorite movie to get started.
      </p>
      <MovieForm />
      <div>
        <LogoutButton />
      </div>
    </div>
  );
}
