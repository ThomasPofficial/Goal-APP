"use server";

import { signIn, signOut } from "@/lib/auth";

export async function serverSignOut() {
  await signOut({ redirectTo: "/login" });
}

export async function serverSignInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}
