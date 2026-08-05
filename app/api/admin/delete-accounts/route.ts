import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// One-off: delete specific test/junk accounts identified via /api/admin/real-accounts.
// Meant to be removed again right after use, not a standing admin feature.
const TARGET_EMAILS = [
  "thomaspiacentine065@gmail.com",
  "nivarrotester@gmail.com",
  "j48456061@gmail.com",
];

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: Record<string, string> = {};

  for (const email of TARGET_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) { results[email] = "not found"; continue; }

    // Delete any Org created by this user first (not cascade from User)
    await prisma.org.deleteMany({ where: { createdById: user.id } });

    // Delete the user — Profile + all relations cascade
    await prisma.user.delete({ where: { id: user.id } });
    results[email] = "deleted";
  }

  return NextResponse.json({ results });
}
