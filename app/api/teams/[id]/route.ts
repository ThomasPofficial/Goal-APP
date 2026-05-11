import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getMyProfileAndVerifyMember(userId: string, teamId: string) {
  const myProfile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!myProfile) return null;
  const membership = await prisma.teamMember.findFirst({
    where: { teamId, profileId: myProfile.id },
  });
  return membership ? myProfile : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const profile = await getMyProfileAndVerifyMember(session.user.id, id);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          profile: {
            select: { id: true, displayName: true, avatarUrl: true, geniusType: true, handle: true, userId: true },
          },
        },
      },
      org: { select: { id: true, name: true } },
      conversation: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  });

  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ team });
}
