import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = searchParams.get("email");
  const pw = searchParams.get("pw");

  if (!email || !pw) {
    return NextResponse.json({ error: "email and pw required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const hasHash = !!user.passwordHash;
  const matches = user.passwordHash ? await bcrypt.compare(pw, user.passwordHash) : false;

  return NextResponse.json({ found: true, hasHash, matches });
}
