import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Scoring helper
// ---------------------------------------------------------------------------
type ScholarRaw = {
  id: string;
  displayName: string | null;
  handle: string | null;
  headline: string | null;
  bio: string | null;
  strengthSummary: string | null;
  avatarUrl: string | null;
  grade: number | null;
  schoolName: string | null;
  interests: string | null;
  orgReviews: {
    id: string;
    body: string | null;
    createdAt: Date;
    org: { name: string };
    orgProject: { title: string } | null;
  }[];
};

function scoreScholar(
  scholar: ScholarRaw,
  queryKeywords: string[]
): { score: number; matchReasons: string[] } {
  let score = 0;
  const matchReasons: string[] = [];

  // ── Review track record ──────────────────────────────────────────────────
  const reviewCount = scholar.orgReviews.length;
  if (reviewCount > 0) {
    const reviewScore = Math.min(40 + (reviewCount - 1) * 5, 60);
    score += reviewScore;
    matchReasons.push(
      `${reviewCount} org review${reviewCount > 1 ? "s" : ""} from previous work`
    );
  }

  // ── Keyword relevance ─────────────────────────────────────────────────────
  if (queryKeywords.length > 0) {
    const searchableText = [
      scholar.headline ?? "",
      scholar.bio ?? "",
      scholar.interests ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const matchedKeywords: string[] = [];
    for (const kw of queryKeywords) {
      if (searchableText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
      if (score + matchedKeywords.length * 5 >= score + 15) break; // cap check
    }

    const keywordScore = Math.min(matchedKeywords.length * 5, 15);
    if (keywordScore > 0) {
      score += keywordScore;
      matchReasons.push(
        `Strong keyword overlap: ${matchedKeywords.slice(0, 3).join(", ")}`
      );
    }
  }

  // ── Profile completeness ──────────────────────────────────────────────────
  if (scholar.strengthSummary) {
    score += 5;
    matchReasons.push("Complete profile with strength summary");
  }

  return { score: Math.min(score, 100), matchReasons };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { query, filters = {} } = body as {
    query?: string;
    filters?: {
      minReviews?: number;
      grade?: number;
      interests?: string[];
    };
  };

  const where: Prisma.ProfileWhereInput = { onboardingComplete: true };

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
      grade: true,
      schoolName: true,
      interests: true,
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

  // Apply minReviews filter
  const minReviews = filters.minReviews ?? 0;
  const filtered = minReviews > 0
    ? scholars.filter((s) => s.orgReviews.length >= minReviews)
    : scholars;

  // Extract meaningful query keywords (skip short/stop words)
  const stopWords = new Set(["the", "and", "for", "with", "that", "this", "a", "an", "in", "of"]);
  const queryKeywords = query
    ? query
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9]/gi, ""))
        .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()))
    : [];

  // Score and annotate each scholar
  const scored = filtered.map((scholar) => {
    const { score, matchReasons } = scoreScholar(scholar, queryKeywords);
    return { ...scholar, score, matchReasons };
  });

  // Sort by score descending; ties broken by review count
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.orgReviews.length - a.orgReviews.length;
  });

  const scoringNote =
    "Scholars scored 0-85 based on: org reviews (track record), keyword relevance, profile completeness. Reviews are private org feedback not visible to students.";

  return NextResponse.json(
    { scholars: scored, total: scored.length, scoringNote },
    { headers: { "X-RateLimit-Remaining": String(auth.callsRemaining) } }
  );
}
