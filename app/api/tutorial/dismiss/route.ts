import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("nv_tutorial_dismissed", "1", {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365 * 5, // 5 years
    path: "/",
    sameSite: "lax",
  });
  return res;
}
