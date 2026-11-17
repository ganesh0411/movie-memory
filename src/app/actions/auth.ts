"use server";

import { signIn, signOut } from "@/auth";

// Land on "/" after sign-in; it routes to /onboarding or /dashboard.
export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
