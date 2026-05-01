"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  email: string,
  password: string
): Promise<{ error: string } | { success: true }> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    // NEXT_REDIRECT means auth succeeded and session cookie is set.
    // We catch it here so NextAuth can't redirect to Render's internal host.
    // The client will navigate using router.push("/dashboard") instead.
    const digest = (error as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) {
      return { success: true };
    }
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}
