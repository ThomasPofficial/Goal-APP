import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  toProfileId: z.string(),
  teamId: z.string(),
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
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const membership = await prisma.teamMember.findFirst({
    where: { teamId: parsed.data.teamId, profileId: myProfile.id },
  });
  if (!membership) return NextResponse.json({ error: "Not on team" }, { status: 403 });

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
      teamId: parsed.data.teamId,
      message: parsed.data.message,
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}
