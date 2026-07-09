import { signIn } from "@/lib/auth";

// Passwordless demo entry point — signs the visitor straight into the
// Westside Academy school-admin demo account. Share this link directly
// with prospects; no login screen, no credentials to type.
export async function GET() {
  await signIn("credentials", {
    email: "school@nivarro.demo",
    password: "demo2026",
    redirectTo: "/dashboard",
  });
}
