import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// One-shot, hardcoded deletion of the specific mock scholar accounts confirmed
// via /api/admin/diagnose-unaffiliated-students on 2026-08-04: unchanged seed
// password + verbatim seed-script bio/headline text, no school affiliation.
// Deliberately NOT a general-purpose "delete by list" endpoint — the target
// list is fixed in source so it can't be pointed at arbitrary accounts.
const CONFIRMED_MOCK_EMAILS = [
  "alex@nivarro.test",
  "sam@nivarro.test",
  "jordan@nivarro.test",
  "morgan@nivarro.test",
  "riley@nivarro.test",
];

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: Record<string, string> = {};

  for (const email of CONFIRMED_MOCK_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) { results[email] = "not found"; continue; }

    const ownedOrgs = await prisma.org.findMany({ where: { createdById: user.id }, select: { id: true, name: true } });

    // Orgs don't cascade from User — delete them first.
    await prisma.org.deleteMany({ where: { createdById: user.id } });

    // Profile + all other relations cascade via onDelete: Cascade.
    await prisma.user.delete({ where: { id: user.id } });

    results[email] = `deleted (orgs removed: ${ownedOrgs.map((o) => o.name).join(", ") || "none"})`;
  }

  return NextResponse.json({ results });
}
