import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";
import type { GeniusType, Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { query, filters = {} } = body as {
    query?: string;
    filters?: {
      geniusType?: GeniusType;
      minReviews?: number;
      grade?: number;
      interests?: string[];
    };
  };

  const where: Prisma.ProfileWhereInput = { onboardingComplete: true };

  if (filters.geniusType) where.geniusType = filters.geniusType;
  if (filters.grade) where.grade = filters.grade;

  if (query || (filters.interests && filters.interests.length > 0)) {
    const terms = [
      ...(query ? [query] : []),
      ...(filters.interests ?? []),
    ];
    where.OR = terms.flatMap((t) => [
      { displayName: { contains: t, mode: "insensitive" as const } },
      { headline: { contains: t, mode: "insensitive" as const } },
      { bio: { contains: t, mode: "insensitive" as const } },
      { interests: { contains: t, mode: "insensitive" as const } },
    ]);
  }

  const scholars = await prisma.profile.findMany({
    where,
    take: 50,
    select: {
      id: true,
      displayName: true,
      handle: true,
      headline: true,
      bio: true,
      strengthSummary: true,
      avatarUrl: true,
      geniusType: true,
      secondaryGeniusType: true,
      grade: true,
      schoolName: true,
      interests: true,
      traitLinks: {
        take: 5,
        include: { trait: { select: { slug: true, name: true, category: true } } },
        orderBy: { order: "asc" },
      },
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const minReviews = filters.minReviews ?? 0;
  const filtered = minReviews > 0
    ? scholars.filter((s) => s.orgReviews.length >= minReviews)
    : scholars;

  const ranked = filtered.sort((a, b) => b.orgReviews.length - a.orgReviews.length);

  return NextResponse.json(
    { scholars: ranked, total: ranked.length },
    { headers: { "X-RateLimit-Remaining": String(auth.callsRemaining) } }
  );
}
