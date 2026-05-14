import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ requests: [] });

  const requests = await prisma.recruitmentRequest.findMany({
    where: { toProfileId: myProfile.id, status: "PENDING" },
    include: {
      orgProject: { select: { id: true, title: true, org: { select: { id: true, name: true } } } },
      fromProfile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
