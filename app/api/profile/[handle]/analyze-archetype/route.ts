import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { runArchetypeAnalysis, ARCHETYPE_MIN_REVIEWS, ARCHETYPE_MIN_WORDS } from "@/lib/runArchetypeAnalysis";

export async function POST(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { handle } = await params;

  const profile = await prisma.profile.findUnique({
    where: { handle },
    include: {
      user: { select: { id: true } },
      orgReviews: { select: { body: true } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const isOwn = profile.user.id === session.user.id;
  const isAdmin = session.user.email === "team.nivarro@gmail.com";
  if (!isOwn && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const qualifyingCount = profile.orgReviews.filter(
    (r) => r.body.trim().split(/\s+/).filter(Boolean).length >= ARCHETYPE_MIN_WORDS
  ).length;

  if (qualifyingCount < ARCHETYPE_MIN_REVIEWS) {
    return NextResponse.json(
      {
        error: `${ARCHETYPE_MIN_REVIEWS} org reviews of ${ARCHETYPE_MIN_WORDS}+ words are required before archetypes can be analyzed. You have ${qualifyingCount}.`,
      },
      { status: 422 }
    );
  }

  try {
    const result = await runArchetypeAnalysis(profile.id);
    if (!result) return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    return NextResponse.json({
      archetypes: result.archetypes,
      analysis: result.analysis,
      updatedAt: result.updatedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
