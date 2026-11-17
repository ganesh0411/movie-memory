"use client";

import Image from "next/image";
import { useState } from "react";
import { initials } from "@/lib/user-display";

type Props = { name: string | null; email: string | null; image: string | null };

// Shows the Google photo, falling back to initials if missing or it fails to load.
export function UserAvatar({ name, email, image }: Props) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    return (
      <Image
        src={image}
        alt=""
        width={64}
        height={64}
        className="size-16 rounded-full"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex size-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    >
      {initials({ name, email })}
    </div>
  );
}
