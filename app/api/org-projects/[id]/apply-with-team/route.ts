import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  memberProfileIds: z.array(z.string()).max(9).default([]),
  whyJoin: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orgProjectId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const orgProject = await prisma.orgProject.findUnique({
    where: { id: orgProjectId },
    include: { org: { select: { id: true, name: true, autoAccept: true, maxTeamSize: true } } },
  });
  if (!orgProject) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (orgProject.listingStatus !== "OPEN") return NextResponse.json({ error: "Project closed" }, { status: 409 });

  const existingApp = await prisma.teamApplication.findFirst({
    where: {
      orgProjectId,
      team: { members: { some: { profileId: myProfile.id } } },
    },
  });
  if (existingApp) return NextResponse.json({ error: "Already applied" }, { status: 409 });

  const { memberProfileIds, whyJoin } = parsed.data;
  const autoAccept = orgProject.org.autoAccept;

  // Resolve userIds for selected teammates so they get conversation access
  const memberProfiles = memberProfileIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: memberProfileIds } },
        select: { id: true, userId: true },
      })
    : [];

  const allUserIds = [session.user.id, ...memberProfiles.map((p) => p.userId)];

  const team = await prisma.team.create({
    data: {
      name: `${myProfile.displayName}'s Team`,
      orgId: orgProject.org.id,
      createdById: session.user.id,
      members: {
        create: [
          { profileId: myProfile.id, role: "ADMIN" },
          ...memberProfileIds.map((pid) => ({ profileId: pid, role: "MEMBER" as const })),
        ],
      },
      conversation: {
        create: {
          type: "TEAM",
          participants: {
            create: allUserIds.map((userId) => ({ userId })),
          },
        },
      },
    },
  });

  const application = await prisma.teamApplication.create({
    data: {
      teamId: team.id,
      orgProjectId,
      whyJoin,
      ...(autoAccept ? { status: "ACCEPTED", decidedAt: new Date() } : {}),
    },
  });

  await prisma.team.update({
    where: { id: team.id },
    data: { status: autoAccept ? "ACCEPTED" : "SUBMITTED" },
  });

  return NextResponse.json(
    { team: { id: team.id }, application, autoAccepted: autoAccept },
    { status: 201 }
  );
}
