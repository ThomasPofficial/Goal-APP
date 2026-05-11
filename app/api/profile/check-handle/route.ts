import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const h = searchParams.get("h");
  if (!h) {
    return NextResponse.json({ error: "Missing h param" }, { status: 400 });
  }

  const existing = await prisma.profile.findFirst({
    where: { handle: h, NOT: { userId: session.user.id } },
  });

  return NextResponse.json({ available: !existing });
}
