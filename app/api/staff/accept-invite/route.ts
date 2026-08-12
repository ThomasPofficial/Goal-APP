import { NextRequest, NextResponse } from "next/server";
import { checkStaffInviteToken, acceptStaffInvite } from "@/lib/staffInvite";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });

  const result = await checkStaffInviteToken(token);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, password, displayName, staffTitle } = body as {
    token?: string;
    password?: string;
    displayName?: string;
    staffTitle?: string;
  };

  // 8-character minimum matches the app's existing standard (reset-password page).
  // Staff accounts reach roster PII and fundraising, so they get the stronger bar.
  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: "token and a password of at least 8 characters are required" }, { status: 400 });
  }

  const result = await acceptStaffInvite({ token, password, displayName, staffTitle });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ userId: result.userId });
}
