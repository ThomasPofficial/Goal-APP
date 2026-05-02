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
    const digest = (error as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) {
      // Digest format: "NEXT_REDIRECT;push;{url};{status}"
      // Auth succeeded → redirecting to /dashboard
      // Auth failed  → redirecting to /login?error=...
      const redirectUrl = digest.split(";")[2] ?? "";
      if (redirectUrl.includes("/dashboard")) {
        return { success: true };
      }
      return { error: "Invalid email or password." };
    }
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
}
