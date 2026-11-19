import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy — Movie Memory" };

// Public, static page (no session read) so Google's OAuth review can reach it.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>

      <section className="space-y-2">
        <h2 className="font-medium">What we store</h2>
        <ul className="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>Your Google account name, email address and profile photo.</li>
          <li>The favorite movie you enter.</li>
          <li>The movie facts generated for you.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Third parties</h2>
        <p className="text-zinc-700 dark:text-zinc-300">
          Your favorite movie title is sent to OpenAI to generate facts. Your data is not sold or
          shared with anyone else.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Deleting your data</h2>
        <p className="text-zinc-700 dark:text-zinc-300">
          To have your data deleted, email{" "}
          <a href="mailto:ganesh0411@gmail.com" className="underline">
            ganesh0411@gmail.com
          </a>
          .
        </p>
      </section>

      <Link href="/" className="text-sm underline">
        Back to home
      </Link>
    </main>
  );
}
