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

  const profiles = await prisma.profile.findMany({
    where: {
      userId: { not: session.user.id },
      ...(q
        ? {
            OR: [
              { displayName: { contains: q } },
              { headline: { contains: q } },
              { strengthSummary: { contains: q } },
            ],
          }
        : {}),
    },
    take: 50,
  });

  const formatted = profiles.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    headline: p.headline,
    avatarUrl: p.avatarUrl,
    strengthSummary: p.strengthSummary,
  }));

  return NextResponse.json({ profiles: formatted });
}
