import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { OrgCategory } from "@prisma/client";

const GENIUS_AFFINITY: Record<string, OrgCategory[]> = {
  DYNAMO: ["COMPETITION", "ACCELERATOR"],
  BLAZE: ["FELLOWSHIP", "CLUB"],
  TEMPO: ["INTERNSHIP", "FELLOWSHIP"],
  STEEL: ["RESEARCH", "BOOTCAMP"],
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const category = searchParams.get("category") as OrgCategory | null;
  const limit = 20;

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { grade: true, interests: true, geniusType: true, savedOpportunities: { select: { opportunityId: true } } },
  });

  const userInterests: string[] = profile?.interests ? JSON.parse(profile.interests) : [];
  const userGrade = profile?.grade;
  const geniusType = profile?.geniusType ?? null;
  const savedIds = new Set((profile?.savedOpportunities ?? []).map((s) => s.opportunityId));

  const where = {
    AND: [
      { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
      ...(userGrade
        ? [{ OR: [{ gradeEligibility: null }, { gradeEligibility: { contains: String(userGrade) } }] }]
        : []),
      ...(category ? [{ category }] : []),
    ],
  };

  const opportunities = await prisma.opportunity.findMany({
    where,
    include: { org: { select: { id: true, name: true, heroUrl: true, accentColor: true } } },
  });

  const scored = opportunities.map((opp) => {
    let score = 0;
    if (geniusType && GENIUS_AFFINITY[geniusType]?.includes(opp.category)) score += 2;
    if (userInterests.length > 0 && opp.description) {
      for (const interest of userInterests) {
        if (opp.description.toLowerCase().includes(interest.toLowerCase())) score += 3;
      }
    }
    return { ...opp, score, saved: savedIds.has(opp.id) };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.getTime() - b.deadline.getTime();
  });

  const start = (page - 1) * limit;
  const paginated = scored.slice(start, start + limit);
  const total = scored.length;

  return NextResponse.json({ opportunities: paginated, total, page, pages: Math.ceil(total / limit) });
}
