import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const submitSchema = z.object({
  projectId: z.string(),
  endorseeId: z.string(),
  traitIds: z.array(z.string()).min(1).max(5),
});

// GET: fetch endorsement status for a project (which peer endorsements are pending)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // Get all project members except self
  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { not: session.user.id } },
    include: {
      user: {
        include: {
          profile: {
            include: {
              traitLinks: {
                orderBy: { order: "asc" },
                include: { trait: true },
              },
            },
          },
        },
      },
    },
  });

  // Get existing endorsements from this user for this project
  const existing = await prisma.peerEndorsement.findMany({
    where: { projectId, endorserId: session.user.id },
    include: { traits: { include: { trait: true } } },
  });

  const existingByEndorsee = Object.fromEntries(
    existing.map((e) => [e.endorseeId, e])
  );

  const result = members.map((m) => ({
    memberId: m.id,
    userId: m.userId,
    profile: m.user.profile,
    endorsed: !!existingByEndorsee[m.userId]?.completedAt,
    endorsementId: existingByEndorsee[m.userId]?.id ?? null,
  }));

  return NextResponse.json(result);
}

// POST: submit endorsement for one peer
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { projectId, endorseeId, traitIds } = parsed.data;

  // Verify both users are members of the project
  const [myMembership, theirMembership] = await Promise.all([
    prisma.projectMember.findFirst({
      where: { projectId, userId: session.user.id },
    }),
    prisma.projectMember.findFirst({
      where: { projectId, userId: endorseeId },
    }),
  ]);

  if (!myMembership || !theirMembership) {
    return NextResponse.json({ error: "Not a project member" }, { status: 403 });
  }

  // Upsert the endorsement record
  const endorsement = await prisma.peerEndorsement.upsert({
    where: {
      projectId_endorserId_endorseeId: {
        projectId,
        endorserId: session.user.id,
        endorseeId,
      },
    },
    create: {
      projectId,
      endorserId: session.user.id,
      endorseeId,
      completedAt: new Date(),
    },
    update: {
      completedAt: new Date(),
    },
  });

  // Replace trait endorsements
  await prisma.peerEndorsedTrait.deleteMany({
    where: { endorsementId: endorsement.id },
  });

  await prisma.peerEndorsedTrait.createMany({
    data: traitIds.map((traitId) => ({
      endorsementId: endorsement.id,
      traitId,
    })),
  });

  return NextResponse.json({ success: true });
}
