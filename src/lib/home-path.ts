// The single routing rule for signed-in users. Pure so it's unit-testable.
export function homePathFor(user: { favoriteMovie: string | null }) {
  return user.favoriteMovie === null ? "/onboarding" : "/dashboard";
}
