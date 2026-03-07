import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category") ?? "";

  const profiles = await prisma.profile.findMany({
    where: {
      userId: { not: session.user.id },
      AND: [
        q
          ? {
              OR: [
                { displayName: { contains: q } },
                { headline: { contains: q } },
                { strengthSummary: { contains: q } },
              ],
            }
          : {},
        category
          ? {
              traitLinks: {
                some: { trait: { category: category as never } },
              },
            }
          : {},
      ],
    },
    include: {
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
    },
    take: 50,
  });

  const formatted = profiles.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    headline: p.headline,
    avatarUrl: p.avatarUrl,
    strengthSummary: p.strengthSummary,
    geniusType: p.geniusType,
    selfTraits: p.traitLinks.map((l) => ({
      name: l.trait.name,
      category: l.trait.category,
    })),
  }));

  return NextResponse.json({ profiles: formatted });
}
