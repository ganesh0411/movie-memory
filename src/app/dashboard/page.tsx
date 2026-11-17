import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FactCard } from "@/components/fact-card";
import { LogoutButton } from "@/components/logout-button";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/dal";
import { displayName } from "@/lib/user-display";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <DashboardGate />
      </Suspense>
    </main>
  );
}

async function DashboardGate() {
  const user = await requireUser();
  // Can't skip onboarding by typing the URL.
  if (user.favoriteMovie === null) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <UserAvatar name={user.name} email={user.email} image={user.image} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayName(user)}</p>
          {user.email && (
            <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
          )}
        </div>
        <LogoutButton />
      </section>

      <p className="text-zinc-600 dark:text-zinc-400">
        Your favorite movie:{" "}
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {user.favoriteMovie}
        </span>
      </p>

      <FactCard />
    </div>
  );
}
