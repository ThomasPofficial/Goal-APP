import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  teamId: z.string(),
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
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const membership = await prisma.teamMember.findFirst({
    where: { teamId: parsed.data.teamId, profileId: myProfile.id },
  });
  if (!membership) return NextResponse.json({ error: "Not on team" }, { status: 403 });

  const existing = await prisma.teamApplication.findUnique({
    where: { teamId_orgProjectId: { teamId: parsed.data.teamId, orgProjectId } },
  });
  if (existing) return NextResponse.json({ error: "Already applied" }, { status: 409 });

  const application = await prisma.teamApplication.create({
    data: {
      teamId: parsed.data.teamId,
      orgProjectId,
      whyJoin: parsed.data.whyJoin,
    },
  });

  await prisma.team.update({
    where: { id: parsed.data.teamId },
    data: { status: "SUBMITTED" },
  });

  return NextResponse.json({ application }, { status: 201 });
}
