// Google accounts can lack a name or photo; these keep the UI graceful.

type DisplayUser = { name: string | null; email: string | null };

export function displayName({ name, email }: DisplayUser) {
  return name?.trim() || email || "Movie fan";
}

export function initials({ name, email }: DisplayUser) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}
