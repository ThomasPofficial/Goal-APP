import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function resolveOrgFromApiKey(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;
  return prisma.org.findUnique({ where: { apiKey: token } });
}

// GET /api/agent/scholar/:id
// Full scholar profile + all reviews. Requires paid org API key.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await resolveOrgFromApiKey(req);
  if (!org) return NextResponse.json({ error: "Unauthorized — valid paid org API key required" }, { status: 401 });
  if (!org.isPaid) return NextResponse.json({ error: "Paid org tier required" }, { status: 403 });

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

  return NextResponse.json({ scholar });
}
