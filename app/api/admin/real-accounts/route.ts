import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Read-only diagnostic: lists every user account NOT created by the seed
// scripts (seed-demo-accounts, seed-org, seed-ridgepoint, seed-school-mock,
// cleanup-demo-data), i.e. accounts a real person created by signing up.
const SEED_EMAIL_DOMAINS = ["@nivarro.demo", "@nivarro.io", "@westside.demo", "@nivarro.dev"];
const SEED_EXACT_EMAILS = ["thomas@piacentine.dev", "team.nivarro@gmail.com"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isAlumni: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const isSeeded = (email: string | null) =>
    !!email && (SEED_EXACT_EMAILS.includes(email) || SEED_EMAIL_DOMAINS.some((d) => email.endsWith(d)));

  const real = users.filter((u) => !isSeeded(u.email));

  return NextResponse.json({
    totalUsers: users.length,
    seededCount: users.length - real.length,
    realCount: real.length,
    realAccounts: real,
  });
}
