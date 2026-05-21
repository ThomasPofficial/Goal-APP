import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const scholar = await prisma.profile.findUnique({
    where: { id },
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
      currentFocus: true,
      isFirstGen: true,
      isInternational: true,
      traitLinks: {
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

  if (!scholar) return NextResponse.json({ error: "Scholar not found" }, { status: 404 });

  return NextResponse.json({ scholar }, { headers: { "X-RateLimit-Remaining": String(auth.callsRemaining) } });
}
