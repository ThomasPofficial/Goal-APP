import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

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

  let preferredTypes: string[] = [];
  try { preferredTypes = JSON.parse(project.preferredGeniusTypes ?? "[]"); } catch { preferredTypes = []; }

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
  });

  const sorted = preferredTypes.length > 0
    ? [
        ...candidates.filter((c) => c.geniusType && preferredTypes.includes(c.geniusType)),
        ...candidates.filter((c) => !c.geniusType || !preferredTypes.includes(c.geniusType)),
      ]
    : candidates;

  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);

  return NextResponse.json({
    candidates: sorted,
    quota: { dailyCap, resetsAt: resetAt.toISOString() },
    exhausted: false,
  });
}
