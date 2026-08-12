import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function buildMatchReason({
  traitMatchCount,
  searchedTraitsCount,
  completenessScore,
  activeProjects,
}: {
  traitMatchCount: number;
  searchedTraitsCount: number;
  completenessScore: number;
  activeProjects: number;
}): string {
  const parts: string[] = [];

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
  const traitsParam = url.searchParams.get("traits") ?? "";
  const parsedMinTraits = parseInt(url.searchParams.get("minTraits") ?? "1", 10);
  const minTraits = Math.max(1, isNaN(parsedMinTraits) ? 1 : parsedMinTraits);
  const dobFrom = url.searchParams.get("dobFrom") ?? "";
  const dobTo = url.searchParams.get("dobTo") ?? "";

  const searchedSlugs = traitsParam
    ? traitsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Build WHERE clause — require at least a display name (so empty signups don't appear)
  const where: Prisma.ProfileWhereInput = {
    userId: { not: userId },
    NOT: { displayName: "" },
  };

  // Keyword filter
  if (q) {
    (where as Record<string, unknown>).AND = [
      {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { headline: { contains: q, mode: "insensitive" } },
          { bio: { contains: q, mode: "insensitive" } },
          { strengthSummary: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
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

    const score =
      traitMatchCount * 2 +
      completenessScore +
      Math.min(activeProjects, 3);

    const matchReason = buildMatchReason({
      traitMatchCount,
      searchedTraitsCount: searchedSlugs.length,
      completenessScore,
      activeProjects,
    });

    return {
      userId: p.userId,
      displayName: p.displayName,
      headline: p.headline,
      avatarUrl: p.avatarUrl,
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
