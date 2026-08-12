import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/orgs/[id]/reviews
// Only the platform admin (team.nivarro@gmail.com) can write reviews on behalf of an org.
// The deadline is set to 7 days after project completion — enforced by the caller when
// triggering the review window; here we just store what's provided.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.email !== "team.nivarro@gmail.com") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: orgId } = await params;
  const { orgProjectId, profileId, body, deadline } = await req.json();

  if (!orgProjectId || !profileId || !body || !deadline) {
    return NextResponse.json({ error: "orgProjectId, profileId, body, and deadline are required" }, { status: 400 });
  }

  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 240) {
    return NextResponse.json(
      { error: `Review must be at least 240 words (currently ${wordCount}). Be specific about what the student did, how they worked, and what you observed.` },
      { status: 422 }
    );
  }

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const project = await prisma.orgProject.findFirst({ where: { id: orgProjectId, orgId } });
  if (!project) return NextResponse.json({ error: "Project not found for this org" }, { status: 404 });

  const review = await prisma.orgReview.upsert({
    where: { orgProjectId_profileId: { orgProjectId, profileId } },
    update: { body, deadline: new Date(deadline) },
    create: { orgId, orgProjectId, profileId, body, deadline: new Date(deadline) },
  });

  return NextResponse.json({ review }, { status: 201 });
}

// GET /api/orgs/[id]/reviews
// Returns all reviews written by this org.
// Access: platform admin sees all; paid orgs see all; scholars see only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orgId } = await params;
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const viewer = await prisma.profile.findUnique({ where: { userId: session.user.id } });

  // Determine access level
  const isPlatformAdmin = session.user.email === "team.nivarro@gmail.com";

  // Scholar can only fetch their own reviews
  if (!isPlatformAdmin && !org.isPaid) {
    if (!viewer) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const reviews = await prisma.orgReview.findMany({
      where: { orgId, profileId: viewer.id },
      include: { orgProject: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ reviews });
  }

  // Paid org or platform admin: fetch all (optionally filtered by profileId)
  const where = profileId ? { orgId, profileId } : { orgId };
  const reviews = await prisma.orgReview.findMany({
    where,
    include: {
      profile: { select: { id: true, displayName: true, handle: true, avatarUrl: true } },
      orgProject: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reviews });
}
