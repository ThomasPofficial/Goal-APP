import { signIn } from "@/lib/auth";

// Passwordless demo entry point — signs the visitor straight into the
// Westside Academy school-admin demo account. Share this link directly
// with prospects; no login screen, no credentials to type.
//
// force-dynamic: without this, Next.js can statically pre-render this
// GET handler at build time (since it reads nothing from the request),
// which would execute signIn() once at build and cache that response
// for every visitor forever.
export const dynamic = "force-dynamic";

export async function GET() {
  await signIn("credentials", {
    email: "school@nivarro.demo",
    password: "demo2026",
    redirectTo: "/dashboard",
  });
}
