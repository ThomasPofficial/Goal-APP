import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { GeniusType, Prisma } from "@prisma/client";

async function resolveOrgFromApiKey(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;
  return prisma.org.findUnique({ where: { apiKey: token } });
}

// POST /api/agent/search
// Accepts freeform query OR structured filters. Returns ranked scholar list with reviews.
// Requires paid org API key in Authorization: Bearer <key> header.
export async function POST(req: Request) {
  const org = await resolveOrgFromApiKey(req);
  if (!org) return NextResponse.json({ error: "Unauthorized — valid paid org API key required" }, { status: 401 });
  if (!org.isPaid) return NextResponse.json({ error: "Paid org tier required" }, { status: 403 });

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

  // Apply minReviews filter post-query (easier than a Prisma _count filter)
  const minReviews = filters.minReviews ?? 0;
  const filtered = minReviews > 0
    ? scholars.filter((s) => s.orgReviews.length >= minReviews)
    : scholars;

  // Sort: scholars with reviews first, then by review count desc
  const ranked = filtered.sort((a, b) => b.orgReviews.length - a.orgReviews.length);

  return NextResponse.json({ scholars: ranked, total: ranked.length });
}
