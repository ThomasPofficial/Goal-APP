import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const where: Prisma.ProfileWhereInput = { onboardingComplete: true };

  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { headline: { contains: q, mode: "insensitive" } },
    ];
  }

  const scholars = await prisma.profile.findMany({
    where,
    take: 20,
    select: {
      id: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      handle: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ scholars });
}
