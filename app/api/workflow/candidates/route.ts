import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/workflow/candidates
// Returns today's algorithm recommendations for the scholar's active workflow.
// Reviews are visible (this is the algorithm gate — paywall mechanism).
// Daily cap: (unfilled spots) * 2. Resets at midnight UTC.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const workflowSession = await prisma.workflowSession.findUnique({
    where: { profileId: profile.id },
    include: {
      orgProject: true,
      team: { include: { members: { select: { profileId: true } } } },
    },
  });

  if (!workflowSession) return NextResponse.json({ error: "No active workflow" }, { status: 404 });
  if (workflowSession.step < 3) return NextResponse.json({ error: "Not in team-building step" }, { status: 400 });

  const project = workflowSession.orgProject;
  const existingMemberIds = workflowSession.team?.members.map((m) => m.profileId) ?? [profile.id];

  // Count how many spots are already filled by accepted team members
  const teamSize = existingMemberIds.length;
  const spotsRemaining = Math.max(0, project.openSpots - teamSize);
  const dailyCap = spotsRemaining * 2;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  let quota = await prisma.algorithmQuota.findUnique({
    where: {
      profileId_orgProjectId_date: {
        profileId: profile.id,
        orgProjectId: project.id,
        date: today,
      },
    },
  });

  const usedCount = quota?.usedCount ?? 0;
  const remaining = Math.max(0, dailyCap - usedCount);

  if (remaining === 0) {
    return NextResponse.json({
      candidates: [],
      quota: { dailyCap, usedCount, remaining: 0, resetsAt: nextMidnightUTC() },
      exhausted: true,
    });
  }

  // Find candidates not already on the team
  const sorted = await prisma.profile.findMany({
    where: {
      id: { notIn: existingMemberIds },
      onboardingComplete: true,
    },
    take: remaining,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      handle: true,
      bio: true,
      strengthSummary: true,
      interests: true,
      grade: true,
      schoolName: true,
      // Reviews visible in algorithm view — this is the paywall mechanism
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true, logoLetter: true, logoBg: true, logoColor: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Record usage
  if (sorted.length > 0) {
    if (quota) {
      await prisma.algorithmQuota.update({
        where: { id: quota.id },
        data: { usedCount: usedCount + sorted.length },
      });
    } else {
      await prisma.algorithmQuota.create({
        data: {
          profileId: profile.id,
          orgProjectId: project.id,
          date: today,
          usedCount: sorted.length,
        },
      });
    }
  }

  return NextResponse.json({
    candidates: sorted,
    quota: {
      dailyCap,
      usedCount: usedCount + sorted.length,
      remaining: Math.max(0, remaining - sorted.length),
      resetsAt: nextMidnightUTC(),
    },
    exhausted: remaining - sorted.length <= 0,
  });
}

function nextMidnightUTC(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}
