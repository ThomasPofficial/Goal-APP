import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma, GeniusType } from "@prisma/client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params;

  const { searchParams } = new URL(req.url);
  const geniusType = searchParams.get("geniusType");
  const traits = searchParams.getAll("trait");
  const q = searchParams.get("q") ?? "";

  const where: Prisma.ProfileWhereInput = { onboardingComplete: true };

  if (geniusType) where.geniusType = geniusType as GeniusType;
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { headline: { contains: q, mode: "insensitive" } },
    ];
  }
  if (traits.length > 0) {
    where.traitLinks = { some: { trait: { slug: { in: traits } } } };
  }

  const scholars = await prisma.profile.findMany({
    where,
    take: 20,
    select: {
      id: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      geniusType: true,
      handle: true,
      traitLinks: {
        take: 3,
        include: { trait: { select: { slug: true, name: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ scholars });
}
