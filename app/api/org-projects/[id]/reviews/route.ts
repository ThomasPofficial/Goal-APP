import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runArchetypeAnalysis, ARCHETYPE_MIN_REVIEWS, ARCHETYPE_MIN_WORDS } from "@/lib/runArchetypeAnalysis";

const ai = new Anthropic();

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { reviews } = body as { reviews?: { profileId: string; body: string }[] };

  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return NextResponse.json({ error: "reviews array required" }, { status: 400 });
  }

  const project = await prisma.orgProject.findUnique({
    where: { id },
    include: { org: { select: { id: true, createdById: true, verified: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.org.createdById !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!project.org.verified)
    return NextResponse.json({ error: "Only verified organizations can submit student reviews" }, { status: 403 });

  for (const r of reviews) {
    const wc = wordCount(r.body ?? "");
    if (wc < ARCHETYPE_MIN_WORDS)
      return NextResponse.json(
        { error: `Review must be at least ${ARCHETYPE_MIN_WORDS} words (got ${wc})` },
        { status: 400 }
      );
  }

  const deadline = new Date();
  deadline.setFullYear(deadline.getFullYear() + 1);

  let created = 0;
  const profilesToCheck = new Set<string>();

  for (const r of reviews) {
    let aiInsight: string | undefined;
    try {
      const msg = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `You are analyzing an organization's written review of a student. Based only on this review, write 2-3 concise sentences summarizing: (1) the student's standout qualities, (2) how they contributed to the project, and (3) one thing to watch for. Be specific and fair. Review:\n\n${r.body.trim()}`,
          },
        ],
      });
      aiInsight = msg.content[0].type === "text" ? msg.content[0].text : undefined;
    } catch {
      // AI failure is non-fatal — save without insight
    }

    await prisma.orgReview.upsert({
      where: { orgProjectId_profileId: { orgProjectId: id, profileId: r.profileId } },
      create: {
        orgId: project.org.id,
        orgProjectId: id,
        profileId: r.profileId,
        body: r.body.trim(),
        deadline,
        ...(aiInsight ? { aiInsight } : {}),
      },
      update: { body: r.body.trim(), ...(aiInsight ? { aiInsight } : {}) },
    });
    created++;
    profilesToCheck.add(r.profileId);
  }

  // Auto-trigger archetype analysis for students who now have 3+ qualifying reviews
  for (const profileId of profilesToCheck) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          animalArchetypes: true,
          orgReviews: { select: { body: true } },
        },
      });
      if (!profile) continue;

      const alreadyHasArchetypes = (() => {
        try { return JSON.parse(profile.animalArchetypes ?? "[]").length > 0; } catch { return false; }
      })();

      if (alreadyHasArchetypes) continue;

      const qualifyingCount = profile.orgReviews.filter(
        (r) => wordCount(r.body) >= ARCHETYPE_MIN_WORDS
      ).length;

      if (qualifyingCount >= ARCHETYPE_MIN_REVIEWS) {
        await runArchetypeAnalysis(profileId);
      }
    } catch {
      // Non-fatal: archetype analysis failure shouldn't block the review response
    }
  }

  return NextResponse.json({ created });
}
