import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";
import type { GeniusType, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Genius-type keyword mapping for query-based detection
// ---------------------------------------------------------------------------
const GENIUS_TYPE_KEYWORDS: Record<string, GeniusType> = {
  steel: "STEEL",
  analytical: "STEEL",
  researcher: "STEEL",
  blaze: "BLAZE",
  leader: "BLAZE",
  founder: "BLAZE",
  dynamo: "DYNAMO",
  builder: "DYNAMO",
  developer: "DYNAMO",
  tempo: "TEMPO",
  connector: "TEMPO",
  communicator: "TEMPO",
};

function detectGeniusTypeFromQuery(query: string): GeniusType | null {
  const lower = query.toLowerCase();
  for (const [keyword, type] of Object.entries(GENIUS_TYPE_KEYWORDS)) {
    if (lower.includes(keyword)) return type;
  }
  return null;
}

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
  geniusType: GeniusType | null;
  secondaryGeniusType: GeniusType | null;
  grade: number | null;
  schoolName: string | null;
  interests: string | null;
  traitLinks: {
    trait: { slug: string; name: string; category: string };
    order: number;
  }[];
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
  queryKeywords: string[],
  targetGeniusType: GeniusType | null
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

  // ── Genius type match ─────────────────────────────────────────────────────
  if (targetGeniusType) {
    if (scholar.geniusType === targetGeniusType) {
      score += 15;
      matchReasons.push(
        `Primary type ${scholar.geniusType} matches ${targetGeniusType} query`
      );
    } else if (scholar.secondaryGeniusType === targetGeniusType) {
      score += 10;
      matchReasons.push(
        `Secondary type ${scholar.secondaryGeniusType} matches ${targetGeniusType} query`
      );
    }
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

  // Apply minReviews filter
  const minReviews = filters.minReviews ?? 0;
  const filtered = minReviews > 0
    ? scholars.filter((s) => s.orgReviews.length >= minReviews)
    : scholars;

  // Determine target genius type: explicit filter takes precedence, then infer from query
  const targetGeniusType: GeniusType | null =
    filters.geniusType ?? (query ? detectGeniusTypeFromQuery(query) : null);

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
    const { score, matchReasons } = scoreScholar(scholar, queryKeywords, targetGeniusType);
    return { ...scholar, score, matchReasons };
  });

  // Sort by score descending; ties broken by review count
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.orgReviews.length - a.orgReviews.length;
  });

  const scoringNote =
    "Scholars scored 0-100 based on: org reviews (track record), genius type match, keyword relevance, profile completeness. Reviews are private org feedback not visible to students.";

  return NextResponse.json(
    { scholars: scored, total: scored.length, scoringNote },
    { headers: { "X-RateLimit-Remaining": String(auth.callsRemaining) } }
  );
}
