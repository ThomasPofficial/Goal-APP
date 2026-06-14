import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const FAKE_EMAILS = [
  "elena@nivarro.demo",
  "james@nivarro.demo",
  "amara@nivarro.demo",
  "noah@nivarro.demo",
  "maya@nivarro.demo",
  "org@nivarro.demo",
  "student@nivarro.demo",
];

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: Record<string, string> = {};

  for (const email of FAKE_EMAILS) {
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
