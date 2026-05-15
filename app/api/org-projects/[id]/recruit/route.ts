import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  toProfileId: z.string(),
  message: z.string().max(500).optional(),
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
    include: { org: { select: { id: true } } },
  });
  if (!orgProject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auto-find the user's team for this org, or create a solo one
  let team = await prisma.team.findFirst({
    where: {
      orgId: orgProject.org.id,
      members: { some: { profileId: myProfile.id } },
    },
  });

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: `${myProfile.displayName}'s Team`,
        orgId: orgProject.org.id,
        createdById: session.user.id,
        members: { create: { profileId: myProfile.id, role: "ADMIN" } },
        conversation: {
          create: {
            type: "TEAM",
            participants: { create: { userId: session.user.id } },
          },
        },
      },
    });
  }

  const existing = await prisma.recruitmentRequest.findUnique({
    where: {
      orgProjectId_fromProfileId_toProfileId: {
        orgProjectId,
        fromProfileId: myProfile.id,
        toProfileId: parsed.data.toProfileId,
      },
    },
  });
  if (existing) return NextResponse.json({ error: "Already sent" }, { status: 409 });

  const request = await prisma.recruitmentRequest.create({
    data: {
      orgProjectId,
      fromProfileId: myProfile.id,
      toProfileId: parsed.data.toProfileId,
      teamId: team.id,
      message: parsed.data.message,
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}
