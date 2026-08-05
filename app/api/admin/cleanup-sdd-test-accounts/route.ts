import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Temporary one-off cleanup endpoint — deletes the 2 throwaway accounts created
// while manually verifying the onboarding-enforcement change against production.
// Delete this file after running it once.
const EMAILS_TO_DELETE = [
  "sdd-verify-test-20260805@nivarro.test",
  "sdd-verify-orgs-20260805@nivarro.test",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.user.deleteMany({
    where: { email: { in: EMAILS_TO_DELETE } },
  });

  return NextResponse.json({ deletedCount: result.count, emails: EMAILS_TO_DELETE });
}
