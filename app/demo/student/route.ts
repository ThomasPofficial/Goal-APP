import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await signIn("credentials", {
      email: "thomas@piacentine.dev",
      password: "demo2026",
      redirectTo: "/dashboard",
    });
  } catch (error) {
    const digest = (error as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    return NextResponse.json(
      {
        debug: true,
        name: (error as Error)?.name,
        message: (error as Error)?.message,
        digest,
      },
      { status: 500 }
    );
  }
}
