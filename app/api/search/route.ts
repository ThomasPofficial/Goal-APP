import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Genius type compatibility scores
// 2 = ideal complement, 1 = good pairing, 0 = same type (not penalised, just not a complement bonus)
const COMPATIBILITY: Record<string, Record<string, number>> = {
  DYNAMO: { STEEL: 2, TEMPO: 1, BLAZE: 0, DYNAMO: 0 },
  BLAZE:  { STEEL: 2, DYNAMO: 1, TEMPO: 0, BLAZE: 0 },
  TEMPO:  { DYNAMO: 2, STEEL: 1, BLAZE: 0, TEMPO: 0 },
  STEEL:  { BLAZE: 2, TEMPO: 2, DYNAMO: 1, STEEL: 0 },
};

function geniusCompatibility(
  myType: string | null | undefined,
  theirType: string | null | undefined
): number {
  if (!myType || !theirType) return 0;
  return COMPATIBILITY[myType]?.[theirType] ?? 0;
}

function buildMatchReason({
  geniusComp,
  traitMatchCount,
  searchedTraitsCount,
  completenessScore,
  activeProjects,
  myGeniusType,
  theirGeniusType,
}: {
  geniusComp: number;
  traitMatchCount: number;
  searchedTraitsCount: number;
  completenessScore: number;
  activeProjects: number;
  myGeniusType: string | null | undefined;
  theirGeniusType: string | null | undefined;
}): string {
  const parts: string[] = [];

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (myGeniusType && theirGeniusType) {
    if (geniusComp === 2) {
      parts.push(`${cap(theirGeniusType)} pairs ideally with your ${cap(myGeniusType)} type`);
    } else if (geniusComp === 1) {
      parts.push(`${cap(theirGeniusType)} pairs well with your ${cap(myGeniusType)} type`);
    }
  }

  if (searchedTraitsCount > 0 && traitMatchCount > 0) {
    parts.push(
      `${traitMatchCount}/${searchedTraitsCount} searched trait${traitMatchCount > 1 ? "s" : ""} matched`
    );
  }

  if (activeProjects > 0) {
    parts.push(
      `${activeProjects} active project${activeProjects > 1 ? "s" : ""}`
    );
  }

  if (completenessScore >= 3) {
    parts.push("complete profile");
  }

  return parts.length > 0 ? parts.join(" · ") : "Profile match";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);

  const q = url.searchParams.get("q") ?? "";
  const geniusTypeFilter = url.searchParams.get("geniusType") ?? "";
  const traitsParam = url.searchParams.get("traits") ?? "";
  const parsedMinTraits = parseInt(url.searchParams.get("minTraits") ?? "1", 10);
  const minTraits = Math.max(1, isNaN(parsedMinTraits) ? 1 : parsedMinTraits);
  const dobFrom = url.searchParams.get("dobFrom") ?? "";
  const dobTo = url.searchParams.get("dobTo") ?? "";

  const searchedSlugs = traitsParam
    ? traitsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Fetch the current user's genius type for compatibility scoring
  const myProfile = await prisma.profile.findUnique({
    where: { userId },
    select: { geniusType: true },
  });
  const myGeniusType = myProfile?.geniusType ?? null;

  // Build WHERE clause — completeness gate always applied
  const where: Prisma.ProfileWhereInput = {
    userId: { not: userId },
    // Completeness gate: must have geniusType, at least one trait, and bio or strengthSummary
    geniusType: { not: null },
    traitLinks: { some: {} },
    OR: [
      { bio: { not: null } },
      { strengthSummary: { not: null } },
    ],
  };

  // Keyword filter
  if (q) {
    (where as Record<string, unknown>).AND = [
      {
        OR: [
          { displayName: { contains: q } },
          { headline: { contains: q } },
          { bio: { contains: q } },
          { strengthSummary: { contains: q } },
        ],
      },
    ];
  }

  // Genius type binary filter
  if (geniusTypeFilter) {
    where.geniusType = geniusTypeFilter as never;
  }

  // DOB range filter — validate dates before using them
  const dobFromDate = dobFrom ? new Date(dobFrom) : null;
  const dobToDate = dobTo ? new Date(dobTo) : null;
  if (
    (dobFromDate && !isNaN(dobFromDate.getTime())) ||
    (dobToDate && !isNaN(dobToDate.getTime()))
  ) {
    where.dateOfBirth = {};
    if (dobFromDate && !isNaN(dobFromDate.getTime()))
      (where.dateOfBirth as Record<string, unknown>).gte = dobFromDate;
    if (dobToDate && !isNaN(dobToDate.getTime()))
      (where.dateOfBirth as Record<string, unknown>).lte = dobToDate;
  }

  const profiles = await prisma.profile.findMany({
    where,
    include: {
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
      user: {
        include: {
          projectMemberships: {
            include: { project: true },
          },
        },
      },
    },
    take: 100,
  });

  // Post-fetch: trait minimum count filter (SQLite lacks HAVING COUNT)
  let filtered = profiles;
  if (searchedSlugs.length > 0) {
    filtered = profiles.filter((p) => {
      const profileSlugs = p.traitLinks.map((l) => l.trait.slug);
      const matchCount = searchedSlugs.filter((slug) =>
        profileSlugs.includes(slug)
      ).length;
      return matchCount >= minTraits;
    });
  }

  // Score and build results
  const results = filtered.map((p) => {
    const profileSlugs = p.traitLinks.map((l) => l.trait.slug);
    const traitMatchCount =
      searchedSlugs.length > 0
        ? searchedSlugs.filter((slug) => profileSlugs.includes(slug)).length
        : 0;

    const projects = p.user.projectMemberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      status: m.project.status,
    }));
    const activeProjects = projects.filter((pr) => pr.status === "ACTIVE").length;

    const completenessScore =
      (p.bio ? 1 : 0) +
      (p.strengthSummary ? 1 : 0) +
      (p.headline ? 1 : 0) +
      (p.avatarUrl ? 1 : 0);

    const geniusComp = geniusCompatibility(myGeniusType, p.geniusType);

    const score =
      geniusComp * 3 +
      traitMatchCount * 2 +
      completenessScore +
      Math.min(activeProjects, 3);

    const matchReason = buildMatchReason({
      geniusComp,
      traitMatchCount,
      searchedTraitsCount: searchedSlugs.length,
      completenessScore,
      activeProjects,
      myGeniusType,
      theirGeniusType: p.geniusType,
    });

    return {
      userId: p.userId,
      displayName: p.displayName,
      headline: p.headline,
      avatarUrl: p.avatarUrl,
      geniusType: p.geniusType,
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().split("T")[0] : null,
      selfTraits: p.traitLinks.map((l) => ({
        name: l.trait.name,
        slug: l.trait.slug,
        category: l.trait.category,
      })),
      projects,
      matchScore: score,
      matchReason,
    };
  });

  // Sort by score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  return NextResponse.json({ results, total: results.length });
}
