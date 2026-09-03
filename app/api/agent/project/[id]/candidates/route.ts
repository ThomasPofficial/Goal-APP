import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

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

function scoreCandidate(
  scholar: ScholarRaw,
  requiredSkills: string[]
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

  // ── Required skills match ────────────────────────────────────────────────
  if (requiredSkills.length > 0) {
    const searchableText = [
      scholar.bio ?? "",
      scholar.headline ?? "",
      scholar.interests ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const matchedSkills: string[] = [];
    for (const skill of requiredSkills) {
      if (searchableText.includes(skill.toLowerCase())) {
        matchedSkills.push(skill);
      }
    }

    const skillScore = Math.min(matchedSkills.length * 5, 20);
    if (skillScore > 0) {
      score += skillScore;
      matchReasons.push(
        `Matches required skills: ${matchedSkills.join(", ")}`
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
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const { id: orgProjectId } = await params;

  const project = await prisma.orgProject.findFirst({
    where: { id: orgProjectId, orgId: auth.orgId },
  });
  if (!project) return NextResponse.json({ error: "Project not found for this org" }, { status: 404 });

  const filledCount = await prisma.teamApplication.count({
    where: { orgProjectId, status: "ACCEPTED" },
  });
  const spotsRemaining = Math.max(0, project.openSpots - filledCount);
  const dailyCap = spotsRemaining * 2;

  if (dailyCap === 0) {
    const resetAt = new Date();
    resetAt.setUTCHours(24, 0, 0, 0);
    return NextResponse.json({
      candidates: [],
      quota: { dailyCap: 0, resetsAt: resetAt.toISOString() },
      exhausted: true,
    });
  }

  let requiredSkills: string[] = [];
  try { requiredSkills = JSON.parse(project.requiredSkills ?? "[]"); } catch { requiredSkills = []; }

  const candidates = await prisma.profile.findMany({
    where: { onboardingComplete: true },
    take: dailyCap,
    orderBy: { createdAt: "desc" },
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
  });

  // Score and annotate each candidate
  const scored = candidates.map((candidate) => {
    const { score, matchReasons } = scoreCandidate(candidate, requiredSkills);
    return { ...candidate, score, matchReasons };
  });

  // Sort by score descending; ties broken by review count
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.orgReviews.length - a.orgReviews.length;
  });

  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);

  const projectContext = {
    title: project.title,
    requiredSkills,
  };

  return NextResponse.json(
    {
      candidates: scored,
      quota: { dailyCap, resetsAt: resetAt.toISOString() },
      exhausted: false,
      projectContext,
    },
    { headers: { "X-RateLimit-Remaining": String(auth.callsRemaining) } }
  );
}
