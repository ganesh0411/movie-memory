import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/dal";
import { homePathFor } from "@/lib/home-path";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Movie Memory</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Save your favorite movie and get fun facts about it.
        </p>
      </div>
      {/* Session read must sit behind Suspense (cacheComponents). */}
      <Suspense fallback={<div className="h-12" />}>
        <LandingGate />
      </Suspense>
      <Link href="/privacy" className="text-sm text-zinc-500 underline">
        Privacy
      </Link>
    </main>
  );
}

async function LandingGate() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));

  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        className="h-12 rounded-full bg-foreground px-6 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Sign in with Google
      </button>
    </form>
  );
}
