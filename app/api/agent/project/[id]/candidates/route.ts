import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function resolveOrgFromApiKey(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;
  return prisma.org.findUnique({ where: { apiKey: token } });
}

// GET /api/agent/project/:id/candidates
// Today's algorithm recommendations for a project, with reviews visible.
// Daily cap is enforced by the formula (spots remaining × 2) per call.
// Requires paid org API key.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await resolveOrgFromApiKey(req);
  if (!org) return NextResponse.json({ error: "Unauthorized — valid paid org API key required" }, { status: 401 });
  if (!org.isPaid) return NextResponse.json({ error: "Paid org tier required" }, { status: 403 });

  const { id: orgProjectId } = await params;

  const project = await prisma.orgProject.findFirst({ where: { id: orgProjectId, orgId: org.id } });
  if (!project) return NextResponse.json({ error: "Project not found for this org" }, { status: 404 });

  const filledCount = await prisma.teamApplication.count({
    where: { orgProjectId, status: "ACCEPTED" },
  });
  const spotsRemaining = Math.max(0, project.openSpots - filledCount);
  const dailyCap = spotsRemaining * 2;

  if (dailyCap === 0) {
    return NextResponse.json({ candidates: [], quota: { dailyCap: 0, resetsAt: nextMidnightUTC() }, exhausted: true });
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

  return NextResponse.json({
    candidates: sorted,
    quota: { dailyCap, resetsAt: nextMidnightUTC() },
    exhausted: false,
  });
}

function nextMidnightUTC(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}
