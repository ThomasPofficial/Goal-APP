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
    return NextResponse.json({
      debug: true,
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      digest: (error as { digest?: string })?.digest,
      stack: (error as Error)?.stack?.split("\n").slice(0, 5),
    });
  }
  return NextResponse.json({ debug: true, note: "signIn returned without throwing" });
}
