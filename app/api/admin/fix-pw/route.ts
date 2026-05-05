import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = "thomaspiacentine6@gmail.com";
  const newPassword = "Thom@6!!!!";

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { email }, data: { passwordHash } });

  return NextResponse.json({ ok: true, message: `Password reset for ${email}` });
}
